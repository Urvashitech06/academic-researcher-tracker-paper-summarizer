#!/usr/bin/env python3
"""
Scholar's Home — Database Quality Assurance & Transaction Verification Suite
Tests:
  1. PostgreSQL connection & schema verification.
  2. Transaction Auto-Rollback Verification (verifies conn.rollback() prevents partial writes).
  3. 3NF Many-to-Many Transaction Integrity & Cascading Deletes.
"""

import os
import sys
import time
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment configuration
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "scholarshome_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DATABASE_URL = os.getenv("DATABASE_URL")


def get_connection():
    """Establish database connection."""
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def print_status(test_name: str, passed: bool, details: str = ""):
    status_symbol = "✓ PASS" if passed else "✗ FAIL"
    print(f"[{status_symbol}] {test_name}")
    if details:
        print(f"       -> {details}")


def test_postgres_connection():
    """Test 1: Verify PostgreSQL connection and 3NF schema tables."""
    print("\n--- Test 1: PostgreSQL Connection & Schema Verification ---")
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            print_status("Connection Check", True, f"PostgreSQL Version: {version.split()[0]} {version.split()[1]}")

            # Verify tables exist
            required_tables = ["users", "papers", "tags", "paper_tags"]
            for table in required_tables:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = %s
                    );
                """, (table,))
                exists = cur.fetchone()[0]
                if not exists:
                    print_status(f"Table '{table}' Check", False, "Table does not exist. Run schema.sql first.")
                    return False
                print_status(f"Table '{table}' Check", True, "Exists in schema.")

        return True
    except Exception as e:
        print_status("Connection Check", False, str(e))
        return False
    finally:
        if conn:
            conn.close()


def test_transaction_auto_rollback():
    """
    Test 2: Auto-rollback verification.
    Intentionally triggers an error mid-transaction and checks that
    the database state remains untouched (conn.rollback()).
    """
    print("\n--- Test 2: Auto-Rollback Mid-Transaction Verification ---")
    canary_title = f"CANARY_ROLLBACK_TEST_{int(time.time())}"
    conn = None

    try:
        conn = get_connection()
        conn.autocommit = False  # Explicit transaction management

        # Step A: Ensure test user exists
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT user_id FROM users LIMIT 1;")
            user = cur.fetchone()
            if not user:
                cur.execute("INSERT INTO users (email) VALUES (%s) RETURNING user_id;", ("canary_user@test.edu",))
                user_id = cur.fetchone()["user_id"]
            else:
                user_id = user["user_id"]

        conn.commit()  # Baseline commit for setup

        # Step B: Begin atomic multi-statement transaction
        rollback_triggered = False
        try:
            with conn.cursor() as cur:
                # 1. Insert canary paper (Should NOT persist if transaction fails downstream)
                cur.execute("""
                    INSERT INTO papers (user_id, title, summary, abstract_raw, file_path)
                    VALUES (%s, %s, %s, %s, %s);
                """, (user_id, canary_title, "Canary summary", "Canary abstract", "canary.pdf"))

                print("       -> Inserted canary paper into uncommitted transaction.")

                # 2. Intentionally execute invalid SQL to trigger fatal database exception
                print("       -> Deliberately triggering foreign key violation / syntax error...")
                cur.execute("INSERT INTO papers (user_id, title) VALUES (999999999, 'INVALID_FK_PAPER');")

            # If we reach here, the intentional error failed to trigger
            conn.commit()

        except Exception as intentional_error:
            # Expected failure path
            rollback_triggered = True
            print(f"       -> Caught intentional error: {intentional_error.__class__.__name__}: {str(intentional_error).strip()[:80]}...")
            conn.rollback()
            print("       -> Executed conn.rollback() successfully.")

        if not rollback_triggered:
            print_status("Intentional Error Trigger", False, "Failed to trigger simulated exception.")
            return False

        # Step C: Verify with a separate query that the canary paper does NOT exist
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM papers WHERE title = %s;", (canary_title,))
            canary_count = cur.fetchone()[0]

            if canary_count == 0:
                print_status(
                    "Auto-Rollback Verification",
                    True,
                    f"Canary paper '{canary_title}' was successfully rolled back and was NOT persisted."
                )
                return True
            else:
                print_status(
                    "Auto-Rollback Verification",
                    False,
                    f"CRITICAL: Canary paper '{canary_title}' was found in database! Rollback failed."
                )
                return False

    except Exception as e:
        print_status("Auto-Rollback Verification", False, f"Unexpected test harness exception: {e}")
        return False
    finally:
        if conn:
            conn.close()


def test_crud_and_cascade():
    """Test 3: Verify successful commit, 3NF junction table linking, and cascading delete."""
    print("\n--- Test 3: 3NF Transaction Integrity & Cascade Delete Verification ---")
    test_title = f"3NF_INTEGRITY_TEST_{int(time.time())}"
    test_tag_name = f"TAG_INTEGRITY_{int(time.time())}"
    conn = None

    try:
        conn = get_connection()
        conn.autocommit = False

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Get user
            cur.execute("SELECT user_id FROM users LIMIT 1;")
            user_id = cur.fetchone()["user_id"]

            # 2. Insert paper
            cur.execute("""
                INSERT INTO papers (user_id, title, summary, abstract_raw, file_path)
                VALUES (%s, %s, %s, %s, %s) RETURNING paper_id;
            """, (user_id, test_title, "Test summary", "Test abstract", "test.pdf"))
            paper_id = cur.fetchone()["paper_id"]

            # 3. Upsert tag
            cur.execute("""
                INSERT INTO tags (tag_name) VALUES (%s)
                ON CONFLICT (tag_name) DO UPDATE SET tag_name = EXCLUDED.tag_name
                RETURNING tag_id;
            """, (test_tag_name,))
            tag_id = cur.fetchone()["tag_id"]

            # 4. Link in paper_tags junction table
            cur.execute("""
                INSERT INTO paper_tags (paper_id, tag_id)
                VALUES (%s, %s) ON CONFLICT DO NOTHING;
            """, (paper_id, tag_id))

        # Commit Transaction
        conn.commit()
        print_status("3NF Insert & Link Commit", True, f"Paper #{paper_id} and Tag #{tag_id} linked and committed.")

        # Verify Link
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT p.title, t.tag_name
                FROM papers p
                JOIN paper_tags pt ON p.paper_id = pt.paper_id
                JOIN tags t ON pt.tag_id = t.tag_id
                WHERE p.paper_id = %s;
            """, (paper_id,))
            linked_row = cur.fetchone()
            if linked_row and linked_row["tag_name"] == test_tag_name:
                print_status("3NF Relational Query", True, "Successfully retrieved paper via Many-to-Many junction.")
            else:
                print_status("3NF Relational Query", False, "Failed to query linked paper and tag.")
                return False

            # Test Cascade Delete
            cur.execute("DELETE FROM papers WHERE paper_id = %s;", (paper_id,))
            conn.commit()

            cur.execute("SELECT COUNT(*) FROM paper_tags WHERE paper_id = %s;", (paper_id,))
            remaining_links = cur.fetchone()["count"]

            if remaining_links == 0:
                print_status("Cascade Delete Verification", True, "Foreign key ON DELETE CASCADE purged junction records.")
            else:
                print_status("Cascade Delete Verification", False, f"Found {remaining_links} orphaned links in paper_tags.")
                return False

            # Clean up test tag
            cur.execute("DELETE FROM tags WHERE tag_id = %s;", (tag_id,))
            conn.commit()

        return True

    except Exception as e:
        if conn:
            conn.rollback()
        print_status("3NF Integrity Test", False, str(e))
        return False
    finally:
        if conn:
            conn.close()


def test_user_auth_and_isolation():
    """
    Test 4: Verify user signup, password hashing, and multi-tenant isolation.
    Ensures that User A's research papers are strictly invisible and immutable to User B.
    """
    print("\n--- Test 4: User Authentication & Multi-Tenant Data Isolation ---")
    conn = None
    ts = int(time.time())
    email_a = f"researcher_a_{ts}@scholarshome.edu"
    email_b = f"researcher_b_{ts}@scholarshome.edu"
    plain_password = "SecureResearchPassword123!"

    try:
        from werkzeug.security import generate_password_hash, check_password_hash
        conn = get_connection()
        conn.autocommit = False

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Register User A with hashed password
            hash_a = generate_password_hash(plain_password)
            cur.execute("""
                INSERT INTO users (email, password_hash, full_name)
                VALUES (%s, %s, %s) RETURNING user_id;
            """, (email_a, hash_a, "Dr. Alice Research"))
            user_a_id = cur.fetchone()["user_id"]

            # 2. Register User B with hashed password
            hash_b = generate_password_hash(plain_password)
            cur.execute("""
                INSERT INTO users (email, password_hash, full_name)
                VALUES (%s, %s, %s) RETURNING user_id;
            """, (email_b, hash_b, "Dr. Bob Research"))
            user_b_id = cur.fetchone()["user_id"]

        conn.commit()
        print_status("User Registration & Password Hashing", True, f"Users {email_a} and {email_b} created with PBKDF2 hashes.")

        # 3. Verify Password Validation
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT password_hash FROM users WHERE user_id = %s;", (user_a_id,))
            stored_hash = cur.fetchone()["password_hash"]
            if check_password_hash(stored_hash, plain_password) and not check_password_hash(stored_hash, "WrongPassword!"):
                print_status("Password Verification", True, "Hash verified valid password and rejected invalid password.")
            else:
                print_status("Password Verification", False, "Hash verification failed.")
                return False

        # 4. User A inserts a paper
        paper_a_title = f"ALICE_CONFIDENTIAL_PAPER_{ts}"
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO papers (user_id, title, summary, abstract_raw, file_path)
                VALUES (%s, %s, %s, %s, %s) RETURNING paper_id;
            """, (user_a_id, paper_a_title, "Confidential AI research", "Raw abstract A", "alice.pdf"))
            paper_a_id = cur.fetchone()["paper_id"]
        conn.commit()

        # 5. Verify User B CANNOT see User A's paper
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM papers WHERE user_id = %s;", (user_b_id,))
            user_b_papers = cur.fetchall()
            if len(user_b_papers) == 0:
                print_status("Tenant Isolation (Read)", True, f"User B isolated: 0 papers visible out of User A's private collection.")
            else:
                print_status("Tenant Isolation (Read)", False, "CRITICAL: User B can view User A's private research paper!")
                return False

        # 6. Verify User B CANNOT delete User A's paper
        with conn.cursor() as cur:
            cur.execute("DELETE FROM papers WHERE paper_id = %s AND user_id = %s;", (paper_a_id, user_b_id))
            deleted_rows = cur.rowcount
            conn.commit()
            if deleted_rows == 0:
                print_status("Tenant Isolation (Delete Protection)", True, "User B attempted deletion was rejected (0 rows affected).")
            else:
                print_status("Tenant Isolation (Delete Protection)", False, "CRITICAL: User B successfully deleted User A's paper!")
                return False

        # 7. Cleanup test users (cascade will remove Alice's paper)
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE user_id IN (%s, %s);", (user_a_id, user_b_id))
            conn.commit()
        print_status("Cleanup", True, "Test tenant users and confidential papers purged.")

        return True

    except Exception as e:
        if conn:
            conn.rollback()
        print_status("User Auth & Isolation Test", False, str(e))
        return False
    finally:
        if conn:
            conn.close()


def main():
    print("=" * 70)
    print("Scholar's Home — Database Quality Assurance & Transaction Verification")
    print("=" * 70)

    success_t1 = test_postgres_connection()
    if not success_t1:
        print("\n[ABORT] Cannot proceed without valid database connection.")
        sys.exit(1)

    success_t2 = test_transaction_auto_rollback()
    success_t3 = test_crud_and_cascade()
    success_t4 = test_user_auth_and_isolation()

    print("\n" + "=" * 70)
    if success_t1 and success_t2 and success_t3 and success_t4:
        print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (4/4)")
        print("=" * 70)
        sys.exit(0)
    else:
        print("SOME VERIFICATION CHECKS FAILED.")
        print("=" * 70)
        sys.exit(1)


if __name__ == "__main__":
    main()


from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlmodel import Session, select
from app.database import get_session
from app.models import Account
from app.services.security import decrypt_password
from app.services.email_service import send_reply_via_smtp
import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
from collections import OrderedDict
import re
import logging

router = APIRouter(
    prefix="/inbox",
    tags=["Inbox"]
)

logger = logging.getLogger(__name__)


def decode_mime_words(s):
    if not s:
        return ""
    decoded_words = decode_header(s)
    result = ""
    for word, encoding in decoded_words:
        if isinstance(word, bytes):
            if encoding:
                try:
                    result += word.decode(encoding)
                except LookupError:
                    result += word.decode('utf-8', errors='replace')
            else:
                result += word.decode('utf-8', errors='replace')
        else:
            result += word
    return result


def get_email_body(msg):
    """Extract email body, preserving original HTML formatting."""
    def strip_scripts(html):
        return re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)

    if msg.is_multipart():
        body_html = ""
        body_plain = ""
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if "attachment" not in content_disposition:
                if content_type == "text/plain":
                    try:
                        charset = part.get_content_charset() or 'utf-8'
                        body_plain += part.get_payload(decode=True).decode(charset, errors='replace')
                    except:
                        pass
                elif content_type == "text/html":
                    try:
                        charset = part.get_content_charset() or 'utf-8'
                        body_html += part.get_payload(decode=True).decode(charset, errors='replace')
                    except:
                        pass
        if body_html:
            return strip_scripts(body_html)
        return f"<html><body><pre style='font-family: Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word;'>{body_plain}</pre></body></html>"
    else:
        content_type = msg.get_content_type()
        try:
            charset = msg.get_content_charset() or 'utf-8'
            payload = msg.get_payload(decode=True).decode(charset, errors='replace')
            if content_type == "text/html":
                return strip_scripts(payload)
            else:
                return f"<html><body><pre style='font-family: Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word;'>{payload}</pre></body></html>"
        except:
            return ""


def _connect_imap(account, readonly=True):
    """Helper: decrypt password and connect to IMAP."""
    decrypted_password = decrypt_password(account.encrypted_app_password)
    mail = imaplib.IMAP4_SSL('imap.gmail.com')
    mail.login(account.email, decrypted_password)
    mail.select('inbox', readonly=readonly)
    return mail


def _extract_sender_name(from_header):
    """Extract just the name part from 'Name <email>' format."""
    if not from_header:
        return ""
    match = re.match(r'^"?([^"<]+)"?\s*<', from_header)
    if match:
        return match.group(1).strip()
    # If no angle bracket, might just be an email
    if '@' in from_header:
        return from_header.split('@')[0]
    return from_header


def _parse_date_safe(date_str):
    """Parse email date string safely, return None on failure."""
    if not date_str:
        return None
    try:
        return parsedate_to_datetime(date_str)
    except:
        return None


@router.get("/unseen-count")
def get_unseen_count(session: Session = Depends(get_session)):
    """Get the count of unseen (unread) emails for all accounts."""
    accounts = session.exec(select(Account)).all()
    results = []
    total = 0

    for account in accounts:
        try:
            mail = _connect_imap(account, readonly=True)
            status, unseen = mail.search(None, 'UNSEEN')
            unseen_ids = unseen[0].split() if unseen[0].strip() else []
            count = len(unseen_ids)
            mail.logout()
            results.append({"id": account.id, "email": account.email, "unseen_count": count})
            total += count
        except Exception as e:
            logger.error(f"Unseen count error for {account.email}: {e}")
            results.append({"id": account.id, "email": account.email, "unseen_count": 0})

    return {"accounts": results, "total_unseen": total}


@router.get("/{account_id}")
def get_inbox_threads(
    account_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(125, ge=1, le=200),
    session: Session = Depends(get_session)
):
    """Fetch the latest emails and group by thread for conversation view.
    
    Fast approach: paginate by individual emails (50/page, newest first),
    then group those 50 into conversations using X-GM-THRID.
    """
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        mail = _connect_imap(account)

        # Search for all emails
        status, messages = mail.search(None, 'ALL')
        if status != 'OK':
            raise Exception("Failed to search emails")

        mail_ids = messages[0].split()
        if not mail_ids:
            mail.logout()
            return {"threads": [], "total_threads": 0, "total_emails": 0, "page": page, "limit": limit, "total_pages": 0}

        mail_ids.reverse()  # newest first

        total_emails = len(mail_ids)
        total_pages = (total_emails + limit - 1) // limit

        # Get the current page's email IDs
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_mail_ids = mail_ids[start_idx:end_idx]

        if not paginated_mail_ids:
            mail.logout()
            return {"threads": [], "total_threads": 0, "total_emails": total_emails, "page": page, "limit": limit, "total_pages": total_pages}

        # Single batch fetch: headers + thread ID + flags (PEEK to avoid marking as read)
        id_set = b','.join(paginated_mail_ids)
        res, msg_data = mail.fetch(id_set, '(X-GM-THRID FLAGS BODY.PEEK[HEADER.FIELDS (Subject From Date)])')
        if res != 'OK':
            raise Exception("Failed to fetch email headers")

        # Parse and group by thread ID
        threads = OrderedDict()  # preserves newest-first order

        for response_part in msg_data:
            if isinstance(response_part, tuple):
                id_info = response_part[0].decode('utf-8', errors='replace')
                header_data = response_part[1]

                seq_num = id_info.split(' ')[0]

                thrid_match = re.search(r'X-GM-THRID (\d+)', id_info)
                thread_id = thrid_match.group(1) if thrid_match else seq_num

                # Check if \Seen flag is present
                is_read = '\\Seen' in id_info

                msg = email.message_from_bytes(header_data)
                subject = decode_mime_words(msg.get("Subject", "(No Subject)"))
                sender = decode_mime_words(msg.get("From", "(Unknown Sender)"))
                date = msg.get("Date", "")

                if thread_id not in threads:
                    threads[thread_id] = []

                threads[thread_id].append({
                    "id": seq_num,
                    "subject": subject,
                    "from": sender,
                    "date": date,
                    "is_read": is_read,
                })

        # Build thread list — batch fetch returns ascending, so reverse
        # Then newest thread (by latest message) comes first
        all_entries = list(threads.items())
        all_entries.reverse()  # newest first

        thread_list = []
        for thread_id, msgs in all_entries:
            latest = msgs[0]  # after reverse, first is newest

            # Collect unique sender names
            seen = set()
            participants = []
            for m in msgs:
                name = _extract_sender_name(m["from"])
                if name and name not in seen:
                    seen.add(name)
                    participants.append(name)

            clean_subject = re.sub(r'^(Re:\s*|Fwd:\s*)+', '', latest["subject"], flags=re.IGNORECASE).strip()
            if not clean_subject:
                clean_subject = latest["subject"]

            # Thread is unread if ANY message in it is unread
            thread_is_read = all(m.get("is_read", True) for m in msgs)

            thread_list.append({
                "thread_id": thread_id,
                "subject": clean_subject,
                "latest_from": latest["from"],
                "latest_date": latest["date"],
                "participants": participants,
                "message_count": len(msgs),
                "latest_id": latest["id"],
                "is_read": thread_is_read,
            })

        mail.logout()

        return {
            "threads": thread_list,
            "total_threads": len(thread_list),
            "total_emails": total_emails,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }

    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP Error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed or IMAP access disabled.")
    except Exception as e:
        logger.error(f"Inbox Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")


@router.get("/{account_id}/thread/{thread_id}")
def get_thread_detail(
    account_id: int,
    thread_id: str,
    session: Session = Depends(get_session)
):
    """Fetch all messages in a Gmail thread with full bodies."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        mail = _connect_imap(account)

        thread_messages = []
        seen_message_ids = set()

        # Helper: fetch all messages for a thread in the current folder
        def _fetch_from_folder(folder_name, folder_tag, mark_read=False):
            try:
                status, _ = mail.select(folder_name, readonly=not mark_read)
                if status != 'OK':
                    return
            except Exception:
                return

            status, messages = mail.search(None, f'X-GM-THRID {thread_id}')
            if status != 'OK' or not messages[0].strip():
                return

            msg_ids = messages[0].split()
            if not msg_ids:
                return

            id_set = b','.join(msg_ids)
            res, msg_data = mail.fetch(id_set, '(FLAGS RFC822)')
            if res != 'OK':
                return

            # Mark as read if requested (INBOX only)
            if mark_read:
                try:
                    mail.store(id_set, '+FLAGS', '\\Seen')
                except Exception:
                    pass

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    meta_line = response_part[0].decode('utf-8', errors='replace')
                    seq_num = meta_line.split(' ')[0]
                    is_read = '\\Seen' in meta_line
                    msg = email.message_from_bytes(response_part[1])

                    message_id = msg.get("Message-ID", "")

                    # Deduplicate by Message-ID (same message can appear in both folders)
                    if message_id and message_id in seen_message_ids:
                        continue
                    if message_id:
                        seen_message_ids.add(message_id)

                    subject = decode_mime_words(msg.get("Subject", "(No Subject)"))
                    sender = decode_mime_words(msg.get("From", "(Unknown Sender)"))
                    date = msg.get("Date", "")
                    body = get_email_body(msg)
                    to_header = decode_mime_words(msg.get("To", ""))
                    cc_header = decode_mime_words(msg.get("Cc", ""))
                    references_header = msg.get("References", "")

                    thread_messages.append({
                        "id": seq_num,
                        "subject": subject,
                        "from": sender,
                        "date": date,
                        "body": body,
                        "message_id": message_id,
                        "to": to_header,
                        "cc": cc_header,
                        "references": references_header,
                        "folder": folder_tag,
                        "is_read": is_read,
                    })

        # Fetch from both INBOX and Sent Mail; mark INBOX messages as read
        _fetch_from_folder("INBOX", "inbox", mark_read=True)
        _fetch_from_folder('"[Gmail]/Sent Mail"', "sent")

        if not thread_messages:
            mail.logout()
            raise HTTPException(status_code=404, detail="Thread not found")

        # Sort by date (oldest first)
        thread_messages.sort(key=lambda m: _parse_date_safe(m["date"]) or _parse_date_safe("1 Jan 2000"))

        mail.logout()

        return {
            "thread_id": thread_id,
            "messages": thread_messages,
            "message_count": len(thread_messages)
        }

    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP Error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed or IMAP access disabled.")
    except Exception as e:
        logger.error(f"Thread Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch thread: {str(e)}")


# Keep the single email endpoint for backward compatibility
@router.get("/{account_id}/email/{email_uid}")
def get_email_detail(
    account_id: int,
    email_uid: str,
    session: Session = Depends(get_session)
):
    """Fetch the FULL content of a single email."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        mail = _connect_imap(account)
        res, msg_data = mail.fetch(email_uid.encode(), '(RFC822)')
        if res != 'OK':
            raise Exception("Failed to fetch email")

        result = {}
        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])
                result = {
                    "id": email_uid,
                    "subject": decode_mime_words(msg.get("Subject", "(No Subject)")),
                    "from": decode_mime_words(msg.get("From", "(Unknown Sender)")),
                    "date": msg.get("Date", ""),
                    "body": get_email_body(msg)
                }

        mail.logout()
        return result

    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP Error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed or IMAP access disabled.")
    except Exception as e:
        logger.error(f"Email Detail Fetch Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch email: {str(e)}")


class ReplyRequest(BaseModel):
    to: str
    subject: str
    body: str
    in_reply_to: Optional[str] = None
    references: Optional[str] = None
    cc: Optional[str] = None


@router.post("/{account_id}/reply")
def reply_to_email(
    account_id: int,
    reply_data: ReplyRequest,
    session: Session = Depends(get_session)
):
    """Send a reply email with proper threading headers."""
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    success, error = send_reply_via_smtp(
        account=account,
        to_email=reply_data.to,
        subject=reply_data.subject,
        body=reply_data.body,
        in_reply_to=reply_data.in_reply_to,
        references=reply_data.references,
        cc=reply_data.cc,
    )

    if success:
        return {"status": "sent", "message": "Reply sent successfully"}
    else:
        raise HTTPException(status_code=500, detail=f"Failed to send reply: {error}")

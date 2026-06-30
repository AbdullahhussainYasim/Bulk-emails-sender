from app.models import Account
from app.services.security import decrypt_password
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import traceback

logger = logging.getLogger(__name__)

def send_email_via_smtp(account: Account, to_email: str, subject: str, body: str):
    msg = MIMEMultipart()
    msg['From'] = account.email
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'html')) # Assuming HTML content from template

    try:
        decrypted_password = decrypt_password(account.encrypted_app_password)
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=10)
        server.starttls()
        server.login(account.email, decrypted_password)
        text = msg.as_string()
        server.sendmail(account.email, to_email, text)
        server.quit()
        return True, None
    except Exception as e:
        logger.error(f"SMTP Error Type: {type(e)}")
        logger.error(f"SMTP Error Args: {e.args}")
        traceback.print_exc() # Print to stderr directly
        return False, str(e)


def send_reply_via_smtp(
    account: Account,
    to_email: str,
    subject: str,
    body: str,
    in_reply_to: str = None,
    references: str = None,
    cc: str = None,
):
    """Send a reply email with proper threading headers.
    
    Args:
        account: The sending account
        to_email: Recipient(s), comma-separated
        subject: Should be 'Re: <original subject>'
        body: HTML body of the reply
        in_reply_to: Message-ID of the email being replied to
        references: Space-separated chain of Message-IDs for threading
        cc: CC recipients, comma-separated
    """
    msg = MIMEMultipart()
    msg['From'] = account.email
    msg['To'] = to_email
    msg['Subject'] = subject

    # Threading headers — these ensure Gmail groups the reply into the same conversation
    if in_reply_to:
        msg['In-Reply-To'] = in_reply_to
    if references:
        msg['References'] = references
    if cc:
        msg['Cc'] = cc

    msg.attach(MIMEText(body, 'html'))

    try:
        decrypted_password = decrypt_password(account.encrypted_app_password)
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=10)
        server.starttls()
        server.login(account.email, decrypted_password)
        
        # Build full recipient list (To + Cc)
        all_recipients = [r.strip() for r in to_email.split(',')]
        if cc:
            all_recipients += [r.strip() for r in cc.split(',')]
        
        server.sendmail(account.email, all_recipients, msg.as_string())
        server.quit()
        logger.info(f"Reply sent from {account.email} to {to_email}")
        return True, None
    except Exception as e:
        logger.error(f"SMTP Reply Error: {type(e).__name__}: {e}")
        traceback.print_exc()
        return False, str(e)

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import EmailTemplate

router = APIRouter(prefix="/template", tags=["template"])

@router.post("", response_model=EmailTemplate)
def create_template(template: EmailTemplate, session: Session = Depends(get_session)):
    count = session.exec(select(EmailTemplate)).all()
    if len(count) == 0:
        template.is_active = True # First template is active by default
    else:
        template.is_active = False # New templates are inactive unless explicitly set
        
    session.add(template)
    session.commit()
    session.refresh(template)
    return template

@router.get("", response_model=list[EmailTemplate])
def get_templates(session: Session = Depends(get_session)):
    templates = session.exec(select(EmailTemplate)).all()
    return templates

@router.put("/{template_id}", response_model=EmailTemplate)
def update_template(template_id: int, template: EmailTemplate, session: Session = Depends(get_session)):
    existing = session.get(EmailTemplate, template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
        
    existing.name = template.name
    existing.subject = template.subject
    existing.body = template.body
    
    session.add(existing)
    session.commit()
    session.refresh(existing)
    return existing

@router.delete("/{template_id}")
def delete_template(template_id: int, session: Session = Depends(get_session)):
    existing = session.get(EmailTemplate, template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
        
    is_active = existing.is_active
    session.delete(existing)
    
    # If deleted was active, make another one active if exists
    if is_active:
        first = session.exec(select(EmailTemplate)).first()
        if first:
            first.is_active = True
            session.add(first)
            
    session.commit()
    return {"ok": True}

@router.post("/{template_id}/active")
def set_active_template(template_id: int, session: Session = Depends(get_session)):
    target = session.get(EmailTemplate, template_id)
    if not target:
        raise HTTPException(status_code=404, detail="Template not found")
        
    all_temps = session.exec(select(EmailTemplate)).all()
    for t in all_temps:
        t.is_active = (t.id == template_id)
        session.add(t)
        
    session.commit()
    return {"message": f"Template {template_id} set as active"}

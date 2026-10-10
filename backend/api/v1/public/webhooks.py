"""Webhooks от платёжных провайдеров."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from modules.billing import service as billing_service
from modules.billing.models import Payment, PaymentStatus
from modules.email import service as email_service
from modules.referrals import service as ref_service
from modules.app_settings.service import robokassa_config
from modules.billing.robokassa import verify_result_signature
from modules.shop import delivery as shop_delivery

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/robokassa", response_class=PlainTextResponse)
async def robokassa_webhook(
    request: Request,
    bg: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Робокасса Result URL.

    Робокасса присылает x-www-form-urlencoded с OutSum, InvId, SignatureValue
    и пользовательскими Shp_*-параметрами (входят в подпись).
    Ответ должен быть строкой `OK<InvId>` для подтверждения.

    `Shp_kind=order` — заказ продукта в Telegram-боте (modules/shop),
    иначе — оплата подписки на тариф (modules/billing).
    """
    form = await request.form()
    OutSum = str(form.get("OutSum", ""))
    InvId = str(form.get("InvId", ""))
    SignatureValue = str(form.get("SignatureValue", ""))
    shp = {k: str(v) for k, v in form.items() if k.startswith("Shp_")}
    if not (OutSum and InvId and SignatureValue):
        raise HTTPException(status_code=400, detail="Missing fields")
    cfg = await robokassa_config(db)
    if not verify_result_signature(cfg, OutSum, InvId, SignatureValue, shp):
        raise HTTPException(status_code=400, detail="Invalid signature")

    if shp.get("Shp_kind") == "order":
        order, newly_paid = await shop_delivery.mark_paid(db, InvId, OutSum)
        if newly_paid:
            bg.add_task(shop_delivery.deliver_order, order.id)
        return f"OK{InvId}"

    payment = await db.scalar(
        select(Payment).where(Payment.provider_payment_id == InvId)
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.status == PaymentStatus.SUCCESS:
        return f"OK{InvId}"

    payment.status = PaymentStatus.SUCCESS
    await billing_service.activate_paid_subscription(db, payment)

    payout = await ref_service.process_payment_for_referral(db, payment)

    if payout is not None:
        from modules.auth.models import User

        referrer = await db.scalar(select(User).where(User.id == payout.referrer_id))
        if referrer:
            bg.add_task(
                email_service.send_referral_payout_email,
                referrer.email,
                str(payout.amount),
            )

    await db.commit()
    return f"OK{InvId}"


@router.post("/stripe")
async def stripe_webhook(request: Request):
    """TODO: реализовать аналогично Робокассе.

    1. body = await request.body()
    2. sig = request.headers.get("stripe-signature")
    3. event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    4. if event.type == "checkout.session.completed":
         найти Payment по metadata.payment_id
         activate_paid_subscription(...)
         process_payment_for_referral(...)
         send_email
    """
    raise HTTPException(status_code=501, detail="Stripe webhook not implemented yet")

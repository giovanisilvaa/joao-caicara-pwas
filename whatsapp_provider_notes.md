# Referências do provedor WhatsApp

A integração escolhida pelo usuário é o Twilio WhatsApp Sandbox.

## Fontes oficiais consultadas

1. Twilio — Quickstart: Send and receive WhatsApp messages: https://www.twilio.com/docs/whatsapp/quickstart
   - O Sandbox de WhatsApp permite ativar um ambiente de teste e conectar um aparelho pelo fluxo “Try out WhatsApp”.
   - O envio usa Account SID e Auth Token da conta Twilio.
   - O número destinatário precisa estar conectado ao Sandbox e os números devem usar formato internacional.

2. Meta — WhatsApp Business Platform: https://developers.facebook.com/documentation/business-messaging/whatsapp/overview
   - A plataforma oficial oferece Cloud API para envio e recebimento por número empresarial.
   - A plataforma possui autenticação, templates e webhooks próprios.

A integração deste projeto usa credenciais protegidas: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM e TWILIO_WHATSAPP_TO. O teste de credenciais validou o endpoint da conta Twilio com HTTP 200, sem enviar uma mensagem real.

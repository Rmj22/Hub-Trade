# Hub Trade → Admin Control 241 integration API

Auth: header `X-API-Key: <INTEGRATION_API_KEY>` (backend/.env; must also be set in production Secrets).
Base: `https://trademainhub.com/api`

- `GET /integration/clients` — one row per Hub Trade user (all accounts; add `?scope=ticket_creators` to limit to ticket creators)
  (client_id, name, email, role, company_id, company_name, plan, membership_status, trial_ends_at, archived_at, created_at, ticket_count, open_tickets, last_ticket_at)
- `GET /integration/tickets?since=<ISO>&status=open|in_progress|completed|closed`
  (ticket_id, title, category, priority, description, hours_requested, status, admin_notes, company_id, company_name, created_by, created_by_id, created_at, updated_at)
- `GET /integration/tickets/{ticket_id}`
- `PUT /integration/tickets/{ticket_id}` body `{status?, admin_notes?}` — writes back; owner gets an in-app notification and sees notes in Data-Entry Help.
- `POST /integration/tickets/{ticket_id}/messages` body `{body, author?, attachments?}` — reply in the ticket thread (owner notified). Tickets include `attachments[]` and `messages[]` ({id, author, author_role owner|admin, body, attachments, created_at}).
- `GET /integration/files/{path}` — download a ticket attachment (path from attachments[].path). Allowed uploads: images, PDF, CSV, TXT, XLS/XLSX, DOC/DOCX, 10 MB.
- `GET /integration/health` — key check: {ok, users, companies, tickets}

## Push webhook (Hub Trade -> Admin Control)
Set backend env `ADMIN_CONTROL_WEBHOOK_URL` (Admin Control endpoint). Hub Trade POSTs JSON `{event, sent_at, data}` with header `X-API-Key: <INTEGRATION_API_KEY>`.
Events: `client.created` (data = client record incl. phone, address, company_phone, member_count) and `ticket.created` (data = ticket). Fire-and-forget, 10s timeout.
Client record fields now also include: phone, address, company_phone, member_count. Register accepts optional phone + address.

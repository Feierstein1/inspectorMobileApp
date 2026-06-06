# Mobile App — Client Signature Flow Redesign

## What changed on the web API side

`requireClientSignature` has been **removed from the Template model** entirely. It no longer exists in the database, schema, or any API response. Do not reference it on templates.

Client signature is now **job-level only**. The source of truth is `job.requireClientSignature` returned by `GET /api/mobile/jobs`.

---

## The full intended flow

1. Admin creates a job with "Require client signature" enabled (`requireClientSignature: true`)
2. Workers complete all assigned submissions for that job
3. Once **all items are COMPLETED**, the job triggers a `CLIENT_SIGNATURE_NEEDED` notification to assigned workers
4. The worker sees a "Client signature needed" state on the job
5. **Two paths to collect the signature:**
   - **On-site (mobile):** Worker opens a signature canvas on their device, client draws their signature, worker submits it
   - **Via email (admin web portal):** Admin sends a review link to the client's email from the Job detail page
6. Once the signature is captured (either path), `job.clientSignatureUrl` is set and `job.clientReviewedAt` is stamped
7. The signature appears in the admin web portal under Job → Client Review

---

## What the mobile app needs to implement

### 1. Detect "needs client signature" state on a job

In `GET /api/mobile/jobs`, each job already returns:
```json
{
  "requireClientSignature": true,
  "clientSignatureUrl": null,
  "clientReviewedAt": null,
  "status": "COMPLETED"
}
```

A job needs an on-site client signature when ALL of these are true:
- `job.requireClientSignature === true`
- `job.status === "COMPLETED"` (all items submitted)
- `job.clientSignatureUrl === null` (not yet signed)

### 2. Show a "Client signature needed" CTA on the job card/detail

When the above conditions are met, show a prominent indicator on the job — e.g. an orange badge "Awaiting client signature" and a button "Capture client signature".

Do NOT show this button if:
- `job.requireClientSignature` is false
- `job.status !== "COMPLETED"` (not all items done yet — workers must finish first)
- `job.clientSignatureUrl` is already set (already signed)

### 3. Signature canvas for on-site capture

When the worker taps the CTA, open a full-screen signature pad. This is the same `SignatureCanvas` pattern used for worker sign-off, but the label should read "Client sign-off" and ideally be shown in a larger/landscape-friendly layout since the client is signing on the worker's device.

### 4. Submit the signature

`POST /api/mobile/jobs/:jobId/client-signature`

**Auth:** Bearer token (same JWT used for all mobile routes)

**Body:**
```json
{
  "imageData": "data:image/png;base64,<base64-encoded PNG>"
}
```

**Success response:**
```json
{ "url": "https://..." }
```

After success:
- Update the job in local state: set `clientSignatureUrl` to the returned URL
- Show a "Client signed ✓" confirmation state on the job card
- The signature will automatically appear in the admin web portal under Job → Client Review

**Error cases:**
- `400` — imageData missing or invalid format
- `400` — "This job does not require a client signature"
- `404` — Job not found or worker not assigned to it
- `401` — Token invalid/expired

### 5. Refresh to check all workers have completed their items

Since multiple workers can be assigned to different items on the same job, the current worker may complete their items before others finish. The mobile app needs a way to know when the WHOLE JOB is completed (not just their own items).

**How to handle:**
- The `job.status` field returned by `GET /api/mobile/jobs` is the authoritative job-level status (`"PENDING"` | `"IN_PROGRESS"` | `"COMPLETED"`)
- Add a "Refresh" / "Check job status" mechanism — either pull-to-refresh on the jobs list or a manual refresh button on the job detail page
- Only show the client signature CTA when `job.status === "COMPLETED"`, which means ALL items across ALL workers are done
- Do not gate this on the worker's own items alone — they may finish early

A SSE/push approach is ideal long-term (the web app has `CLIENT_SIGNATURE_NEEDED` as a notification type that fires when the job completes). For now, pull-to-refresh is sufficient.

### 6. After client signs

Update the local job state:
- Set `clientSignatureUrl` to the URL returned by the API
- Hide the "Capture client signature" CTA
- Show a "Client signed ✓" badge on the job card
- If the job had `clientSignatureUrl: null` before and now it's set, this is the final step — the job is fully complete

---

## What NOT to change

- **Worker signatures** remain per-template (`template.requireWorkerSignature`) — no change to that flow
- The `POST /api/mobile/items/:id/worker-signature` endpoint is unchanged
- The `GET /api/mobile/jobs` response shape is unchanged — `requireClientSignature` and `clientSignatureUrl` are already returned at the job level

---

## Questions for the web AI

1. When `job.status` transitions to `COMPLETED` and `requireClientSignature` is true, the server fires a `CLIENT_SIGNATURE_NEEDED` notification to assigned workers. Does the SSE endpoint (`GET /api/events`) push this to connected clients? If so, the mobile app could listen for it via a WebSocket/SSE connection rather than polling.

2. After the worker submits the client signature via `POST /api/mobile/jobs/:id/client-signature`, does `syncJobStatus` run again? Or does the job status stay as `COMPLETED` and the only change is `clientSignatureUrl` being set? Confirming this so the mobile app knows what fields to expect to change after submission.

3. Is there a `GET /api/mobile/jobs/:id` endpoint to refresh a single job without re-fetching the full list? If not, the mobile app will call `GET /api/mobile/jobs` on pull-to-refresh. That's fine, just confirming.

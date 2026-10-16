APEX 4.0.69 — Grade Projection

Adds an isolated, read-only Grade Projection card to the device Refurbishment tab. It uses the assigned current grade and existing asset requirements, including imported RefurbFlow requirements before a job exists. The live job is authoritative when present, even with no parts. Ordered and fitted tasks remain included.

A full or generic Respray task projects Excellent body condition under the agreed workshop rule, subject to a scratch-free screen and Excellent finish on all remaining surfaces. Partial resprays do not automatically promote a grade. Without full respray, the assigned cosmetic grade is conservatively retained because a parts list cannot establish all remaining wear. A/B/C map to Excellent/Good/Fair; unassessed assets require assessment. Battery and functional checks are separate. Explanations disclose the assumptions and Back Market cosmetic criteria.

No backend writes, schema migrations, new data fields or automatic grade changes. Removing the card requires no data migration. Release 4.0.68 remains available as the previous installer.

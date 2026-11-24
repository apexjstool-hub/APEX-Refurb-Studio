#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const checks={
  'Edge Function source': 'cloud/supabase/functions/apex-device-intake/index.ts',
  'Intake SQL migration': 'cloud/device-cloud-intake.sql',
  'Re-entry SQL migration': 'cloud/automatic-diagnostics-reentry.sql',
  'Diagnostics Sync 2 notes migration': 'cloud/diagnostics-sync-2-notes-migration.sql',
};
let missing=false;
for(const [name,relative] of Object.entries(checks)){
 const ok=fs.existsSync(path.join(root,relative));
 console.log(`${ok?'PASS':'MISSING'}: ${name} (${relative})`);if(!ok)missing=true;
}
console.log('NOT VERIFIED: live Supabase SQL migrations, Edge Function deployment, staff RLS, cross-network Sync, device authorisation.');
console.log('No changes were made to your database, GitHub or applications.');
process.exitCode=missing?1:0;

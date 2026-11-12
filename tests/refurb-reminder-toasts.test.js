'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const c=fs.readFileSync(path.join(__dirname,'../src/renderer/refurb-reminders.js'),'utf8');
test('reminders no longer create the Work Queue alert panel',()=>{
 assert.doesNotMatch(c,/createElement\('section'\)/);
 assert.doesNotMatch(c,/Inactive refurbishment reminders/);
 assert.match(c,/\$\('apexAgeingAlerts'\)\?\.remove\(\)/);
});
test('reminders display limited-duration toast with accessible actions',()=>{
 assert.match(c,/id='apexReminderToast'/);
 assert.match(c,/data-reminder-open/);
 assert.match(c,/data-reminder-snooze/);
 assert.match(c,/data-reminder-close/);
 assert.match(c,/12000/);
 assert.match(c,/setPage\('refurbWorkspace',true\)/);
});
test('existing configuration, snooze, desktop notifications and checks survive',()=>{
 assert.match(c,/settings\.popup/);
 assert.match(c,/settings\.repeatHours/);
 assert.match(c,/desktopReminderNotify/);
 assert.match(c,/snoozed\.set\(row\.id/);
 assert.match(c,/setInterval\(\(\)=>\{draw\(\);backgroundCheck\(\);\},60000\)/);
});

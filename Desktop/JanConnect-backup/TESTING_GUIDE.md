# Appeal & Reappeal Feature - Testing Guide

## Quick Start

### Prerequisites
1. Backend running: `npm start` from `/backend` folder
2. MongoDB connection working
3. Browser access to `http://localhost:5000`

---

## Scenario 1: User Reviews & Closes Complaint (Satisfied)

### Steps:

1. **Login as Citizen**
   - Navigate to citizen-dashboard.html
   - Login with test account

2. **Find a Resolved Complaint**
   - Look for complaint with status badge "Resolved"
   - Should see new blue "📋 Appeal" button

3. **Click Appeal Button**
   - Button text: "📋 Appeal"
   - Opens: `appeal-detail.html?id=COMPLAINT_ID`

4. **Review Details**
   - Verify complaint ID, category, title displayed
   - Check Assigned Officer name visible
   - Review resolution notes from admin
   - See Before (original) and After (fix) images

5. **Select Satisfaction**
   - Click "✓ Yes, Satisfied" button
   - Green button should highlight
   - Feedback textarea should hide

6. **Close Complaint**
   - Click "✓ Close Complaint" button (green)
   - Confirm in popup: "Are you sure..."
   - Success toast: "✓ Thank you! Complaint closed successfully"
   - Redirect to dashboard
   - Check complaint status changed to "Closed"

### Expected Results: ✅
- Complaint status changes from "Resolved" → "Closed"
- `userSatisfied` is set to `true`
- User cannot reappeal after closing
- Admin sees green indicator: "✓ User confirmed satisfied"

---

## Scenario 2: User Reopens Complaint (Unsatisfied)

### Steps:

1. **Login as Citizen**
   - Navigate to citizen-dashboard.html
   - Login with test account

2. **Open Resolved Complaint**
   - Click "📋 Appeal" button

3. **Select Not Satisfied**
   - Click "✗ No, Not Satisfied" button
   - Red button should highlight
   - Feedback textarea should appear
   - "🔄 Request Review" button should enable

4. **Add Feedback (Optional)**
   - Type in feedback textarea: "The issue is not completely fixed..."

5. **Request Review**
   - Click "🔄 Request Review" button
   - Modal opens: "Request Review / Reappeal"
   - Add reason: "The potholes are still visible on the main road"
   - Click "Submit Reappeal"
   - Confirm in popup: "Are you sure..."

6. **Verify Changes**
   - Success toast: "✓ Review request submitted..."
   - Redirect to dashboard
   - Complaint status changes: "Resolved" → "Reopened"
   - Orange badge shows "Reopened"

### Expected Results: ✅
- Complaint status changes from "Resolved" → "Reopened"
- `userSatisfied` is set to `false`
- `reappeal_reason` populated with user's reason
- `reappeal_count` incremented
- SLA timer reset for 24 hours
- Admin dashboard shows red indicator: "✗ User requested review"
- Admin can now re-resolve

---

## Scenario 3: Admin Cannot Change Status While Awaiting Confirmation

### Steps:

1. **As Admin User**
   - Login to admin-dashboard.html

2. **View Resolved Complaint**
   - Find complaint with status "Resolved"
   - Check for **yellow indicator**: "⏳ Awaiting user satisfaction confirmation..."

3. **Try to Change Status**
   - Status dropdown should be **DISABLED** (grayed out)
   - Hover over disabled dropdown
   - Tooltip should appear: "Cannot modify: Awaiting user satisfaction confirmation"

4. **Try Keyboard Change**
   - Try clicking dropdown anyway → No effect
   - Toast should NOT appear

5. **Wait for User Confirmation**
   - Once citizen clicks "Close Complaint"
   - Refresh admin dashboard
   - Yellow indicator changes to **green**: "✓ User confirmed satisfied"
   - Status dropdown now **ENABLED**
   - Can change status normally

### Expected Results: ✅
- Status dropdown disabled for unconfirmed resolved complaints
- Backend validation prevents status changes
- Visual feedback via disabled styling + tooltip
- Status dropdown enables after user confirmation
- Error toast if admin tries invalid changes

---

## Scenario 4: Admin Re-resolves After User Reappeal

### Steps:

1. **Complete Scenario 2** (User reopens complaint)

2. **As Admin User**
   - Refresh dashboard
   - Find complaint now with status "Reopened"
   - Red indicator shows: "✗ User requested review"
   - Orange status badge

3. **Review & Rework**
   - Click "Show Details" to see reappeal reason
   - Verify what user complained about
   - Work on fixing the remaining issues

4. **Re-resolve**
   - Mark status as "In Progress" (if not already)
   - Click "✓ Resolve" button
   - Add new resolution notes: "Completely repaired the potholes..."
   - Upload new after image showing fix
   - Submit

5. **Monitor Again**
   - Status changes: "Reopened" → "Resolved"
   - Yellow indicator appears: "⏳ Awaiting user satisfaction..."
   - Status dropdown disabled again
   - Cycle repeats

### Expected Results: ✅
- Admin can work on complaint again after reappeal
- New resolution provided
- User gets chance to confirm new resolution
- System enforces feedback cycle

---

## Visual Indicators Reference

### Admin Dashboard - Resolved Complaints:

| Indicator | Color | Meaning | Status Dropdown |
|-----------|-------|---------|-----------------|
| ⏳ Awaiting user satisfaction... | Yellow | Waiting for user feedback | **DISABLED** |
| ✓ User confirmed satisfied | Green | User happy, complaint closing | **ENABLED** |
| ✗ User requested review | Red | User reopened, needs rework | **ENABLED** |

---

## Database Verification

### Check Using MongoDB:

```javascript
// Find complaint with satisfaction tracking
db.complaints.findOne(
    { complaintId: "TEST_COMPLAINT_ID" },
    { 
        status: 1,
        userSatisfied: 1,
        userSatisfactionFeedback: 1,
        satisfactionSubmittedAt: 1,
        reappeal_status: 1,
        reappeal_reason: 1,
        reappeal_count: 1
    }
)
```

### Expected Output:

**Scenario 1 (Closed - Satisfied):**
```json
{
    "status": "Closed",
    "userSatisfied": true,
    "userSatisfactionFeedback": null,
    "satisfactionSubmittedAt": ISODate("2024-03-08T10:30:00Z"),
    "reappeal_status": false,
    "reappeal_reason": "",
    "reappeal_count": 0
}
```

**Scenario 2 (Reopened - Not Satisfied):**
```json
{
    "status": "Reopened",
    "userSatisfied": false,
    "userSatisfactionFeedback": "The issue is not completely fixed...",
    "satisfactionSubmittedAt": ISODate("2024-03-08T10:35:00Z"),
    "reappeal_status": true,
    "reappeal_reason": "The potholes are still visible on the main road",
    "reappeal_count": 1
}
```

---

## Common Issues & Troubleshooting

### Issue: Appeal button not showing
**Solution:**
- Ensure complaint has status = "Resolved"
- Clear browser cache
- Refresh citizen-dashboard.html
- Check browser console for errors

### Issue: Satisfaction form not submitting
**Solution:**
- Check browser console for error messages
- Verify server is running (`npm start`)
- Check MongoDB connection
- Ensure ComplaintId is valid

### Issue: Admin status dropdown not disabled
**Solution:**
- Refresh admin dashboard
- Verify `userSatisfied` is null in database
- Check browser console for errors
- Try F5 hard refresh

### Issue: Images not loading in appeal page
**Solution:**
- Verify images are base64 encoded or valid URLs
- Check `image` and `afterImage` fields in database
- Verify server CORS settings
- Check network tab in browser DevTools

### Issue: Reappeal reason not saving
**Solution:**
- Type at least one character in reason field
- Verify modal shows correctly
- Check network tab - should POST to `/reappeal` endpoint
- Verify MongoDB write permissions

---

## Performance Notes

- **Page Load:** ~500ms with images
- **Database Queries:** 1-2 queries per page load
- **Image Display:** Uses lightbox for optimization
- **Real-time Updates:** Requires page refresh (no WebSockets)

---

## API Testing (Using cURL or Postman)

### Submit Satisfaction:
```bash
POST http://localhost:5000/api/complaints/COMPLAINT_ID/satisfaction
Content-Type: application/json

{
    "satisfied": true,
    "feedback": "Great work! Issue resolved completely."
}
```

### Submit Reappeal:
```bash
POST http://localhost:5000/api/complaints/COMPLAINT_ID/reappeal
Content-Type: application/json

{
    "reappeal_reason": "The issue still exists",
    "reappeal_comment": "Needs more attention"
}
```

### Close Complaint:
```bash
POST http://localhost:5000/api/complaints/COMPLAINT_ID/close
Content-Type: application/json
```

### Check Status (With Validation):
```bash
PATCH http://localhost:5000/api/complaints/COMPLAINT_ID/status
Content-Type: application/json

{
    "status": "Escalated"
}

# If userSatisfied !== true and status is Resolved:
# Response:
# {
#     "error": "Cannot modify a resolved complaint until the user confirms satisfaction...",
#     "requiresUserConfirmation": true,
#     "userSatisfied": null
# }
```

---

## Checklist: Feature Complete ✅

- [ ] Appeal detail page loads for resolved complaints
- [ ] Before/after images display correctly
- [ ] User can select satisfaction status
- [ ] Feedback text area toggles based on selection
- [ ] Close button works for satisfied users
- [ ] Reappeal button works for unsatisfied users
- [ ] Status changes reflect in database
- [ ] Admin dashboard shows indicators
- [ ] Status dropdown disables for unconfirmed complaints
- [ ] Error messages display appropriately
- [ ] Toast notifications work
- [ ] Lightbox shows full-size images
- [ ] Multiple reappeals tracked correctly
- [ ] SLA resets on reappeal
- [ ] Backend validation prevents invalid changes

---

## Contact & Support

For issues or questions:
1. Check browser console (F12)
2. Check server logs
3. Verify MongoDB connection
4. Review APPEAL_REAPPEAL_FEATURE.md for detailed docs

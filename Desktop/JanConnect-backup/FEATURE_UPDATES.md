# JanConnect - Feature Updates & Integration Summary

## Overview
This document details all the updates and new features integrated into the JanConnect Smart Grievance System. The complaint workflow has been enhanced with a reappeal/reopen mechanism and resolution confirmation feature.

---

## 🔄 Complaint Status Workflow

### Previous Statuses
- Pending
- In Progress
- Resolved
- Escalated

### Updated Statuses
- **Pending** - Complaint just filed
- **In Progress** - Assigned to officer
- **Resolved** - Officer marks as resolved with after-image and notes
- **Reopened** - Citizen reappealed the resolution
- **Closed** - Citizen confirmed satisfaction with resolution
- **Escalated** - Auto-escalated after SLA breach

---

## 📋 Database Model Updates

### File: `backend/models/Complaint.js`

#### New Fields Added:
1. **Resolution Fields** (filled by admin/officer):
   - `afterImage` - URL/base64 of after image showing resolution
   - `resolutionNotes` - Admin's resolution notes

2. **Reappeal Fields** (filled by citizen):
   - `reappeal_status` - Boolean flag for reappeal submitted
   - `reappeal_reason` - Reason for reappeal
   - `reappeal_comment` - Additional comments from citizen
   - `reappeal_image` - Evidence image for reappeal
   - `reappeal_count` - Number of times complaint has been reappealed

3. **Support Fields** (crowd support):
   - `support_count` - Count of citizens supporting complaint
   - `supporters` - Array of supporter emails

4. **Priority Field**:
   - `priority` - Normal, High, or Urgent

#### Updated Enums:
```javascript
status: ['Pending', 'In Progress', 'Resolved', 'Escalated', 'Reopened', 'Closed']
slaStatus: ['Within SLA', 'SLA Breached', 'Resolved', 'Escalated', 'Reopened']
priority: ['Normal', 'High', 'Urgent']
```

---

## 🗄️ Backend API Updates

### File: `backend/server.js`

#### New Routes Added:

1. **Check for Duplicate Complaints**
   ```
   POST /api/complaints/check-duplicate
   Body: { category, ward }
   Response: { duplicate: boolean, ...complaintDetails if duplicate }
   ```
   - Checks for similar complaints within 24 hours
   - Prevents duplicate complaints

2. **Support Complaint**
   ```
   POST /api/complaints/:complaintId/support
   Body: { citizenEmail }
   Response: { message, support_count }
   ```
   - Citizen can support existing complaints
   - Increments support count
   - Prevents duplicate support from same user

3. **Admin Resolves Complaint**
   ```
   PATCH /api/complaints/:complaintId/resolve
   Body: { afterImage, resolutionNotes }
   Response: { message, complaint }
   ```
   - Admin provides after-image and resolution notes
   - Changes status to "Resolved"
   - **Note:** Complaint stays Resolved until citizen acts

4. **Citizen Reappeals Complaint**
   ```
   POST /api/complaints/:complaintId/reappeal
   Body: { reappeal_reason, reappeal_comment, reappeal_image }
   Response: { message, complaint }
   ```
   - Only works if status is "Resolved"
   - Changes status to "Reopened"
   - Increments reappeal_count
   - Citizens provide reason and evidence

5. **Citizen Closes Complaint**
   ```
   POST /api/complaints/:complaintId/close
   Response: { message, complaint }
   ```
   - Only works if status is "Resolved"
   - Changes status to "Closed"
   - Marks as satisfied by citizen

#### Updated Routes:
- Status update enum expanded to include 'Reopened' and 'Closed'
- Officer assignment now auto-sets status to 'In Progress'
- Complaint ID format changed: `SG-YEAR` + random numbers

---

## 🎨 Frontend Updates

### File: `frontend/complaint-detail.html`

#### Major Features Added:

1. **Resolution Review Section**
   - Shows complaint summary with ID, officer, category, status
   - Before/After image comparison
   - Resolution notes from admin

2. **Satisfaction Confirmation Dialog**
   ```
   "Are you satisfied with the resolution of your complaint?"
   - ✅ Yes, Close Complaint
   - ❌ No, Reopen Complaint
   ```

3. **Reappeal Form** (appears when user clicks "No, Reopen")
   - Reason dropdown for reappeal
   - Comments textarea
   - Evidence image upload
   - Submit button

4. **Status-Based Logic**
   - If Resolved: shows satisfaction dialog
   - If Reopened: shows reappeal history
   - If Closed: shows confirmation message
   - If In Progress: shows SLA timer and notes

### File: `frontend/citizen-dashboard.html`

#### New Features:
1. **Duplicate Detection Modal**
   - Warns user if similar complaint exists within 24 hours
   - Shows existing complaint details
   - Options to support or create new

2. **Support Functionality**
   - "Support This Complaint" button on complaint cards
   - Shows support count
   - Prevents re-supporting same complaint

3. **Enhanced Complaint Display**
   - Support count badge
   - Supporters list
   - Reappeal history

### File: `frontend/admin-dashboard.html`

#### Updated Features:
1. **Complaint Cards Enhanced**
   - Shows support count
   - New status badges for Reopened and Closed
   - Better visual hierarchy

2. **Status Management**
   - Can mark as In Progress -> Resolved (with after-image)
   - Can mark reopened complaints as In Progress again
   - Better status tracking

3. **Officer Assignment**
   - Auto-sets to In Progress when assigned
   - Shows assignment details

---

## 🔐 Business Logic Rules

### Complaint Resolution Workflow:

```
Pending 
  ↓
  → (Assign Officer)
    ↓
    In Progress
    ↓
    (24h SLA countdown)
    ├─ (SLA breached) → Escalated
    └─ (Officer resolves) → Resolved
       ↓
       "Is citizen satisfied?"
       ├─ YES → Close Complaint → Closed ✅
       └─ NO → Reappeal → Reopened
          ↓
          (Goes back to In Progress)
          ├─ (Officer resolves again)
          │  └─ → Resolved
          │     └─ (Satisfaction dialog again)
          └─ (Process repeats)
```

### Key Business Rules:

1. **Admin Cannot Close Without Citizen Confirmation**
   - Admin can only mark as "Resolved"
   - Citizen must confirm closure via "Close Complaint" button
   - Until then, admin's resolve option remains available

2. **Reappeal Only After Resolution**
   - Citizens can only reappeal "Resolved" complaints
   - Must provide reason and optional evidence
   - Complaint automatically reopened with "Reopened" status

3. **Support System**
   - Citizens can support other's complaints
   - Each citizen can support only once per complaint
   - Prevents duplicate support from same user

4. **Duplicate Prevention**
   - System checks for similar complaints within 24 hours
   - Same category + ward = potential duplicate
   - User warned and can support existing complaint instead

---

## 📊 SLA Management

### SLA Timeline:
- **Created**: Complaint filed
- **+24 hours**: SLA deadline
- If not resolved → Auto-escalated to "Escalated" status
- SLA resets on reappeal

### SLA Status Values:
- `Within SLA` - Complaint created, within 24 hours
- `SLA Breached` - 24 hours exceeded, auto-escalated
- `Resolved` - Marked resolved by officer
- `Escalated` - Auto-escalated after SLA breach
- `Reopened` - Citizen reappealed the resolution

---

## 🛠️ Installation & Setup

### Prerequisites:
- Node.js (v14+)
- MongoDB Atlas
- All dependencies in `backend/package.json`

### Steps:
1. Update models: `backend/models/Complaint.js` ✅
2. Restart backend: `npm start` or `node server.js`
3. Frontend automatically uses new APIs
4. Database documents will have new fields (they'll be null initially)

---

## 📱 API Response Examples

### File Complaint Response:
```json
{
  "complaintId": "SG-202620847365",
  "category": "Road Maintenance",
  "ward": "Ward 5",
  "title": "Pothole on Main Street",
  "status": "Pending",
  "slaDeadline": "2026-03-09T12:00:00Z",
  "support_count": 0,
  "supporters": []
}
```

### Resolved Complaint Response:
```json
{
  "complaintId": "SG-202620847365",
  "status": "Resolved",
  "afterImage": "data:image/jpeg;base64,...",
  "resolutionNotes": "Pothole filled and sealed",
  "reappeal_status": false
}
```

### Reopened Complaint Response:
```json
{
  "complaintId": "SG-202620847365",
  "status": "Reopened",
  "reappeal_status": true,
  "reappeal_reason": "Work not done properly",
  "reappeal_comment": "Pothole still visible",
  "reappeal_image": "data:image/jpeg;base64,...",
  "reappeal_count": 1
}
```

---

## ✨ User Experience Flowchart

### Citizen Journey:
```
1. File Complaint
   ↓
2. System checks for duplicates
   ├─ Duplicate found? → Suggest support existing
   └─ No duplicate? → Create new
3. Officer assigned and works on it
4. Officer marks RESOLVED (with after-image)
5. System shows: "Satisfied with resolution?"
   ├─ YES → Close Complaint (CLOSED state) ✅
   └─ NO → Show Reappeal Form
6. Fill reappeal details and submit
7. Goes back to "In Progress" 
8. Officer reviews and resolves again
9. Cycle repeats until satisfied
```

### Admin/Officer Journey:
```
1. View all complaints in dashboard
2. Sort by priority/status/SLA
3. Assign officer to complaint
4. View complaint details
5. Mark "In Progress"
6. Resolve with after-image proof
   (Status: Resolved)
7. If citizen reappeals → back to In Progress
8. Can see reappeal details and resolve again
9. Once citizen closes → Final status: Closed
```

---

## 🔧 Troubleshooting

### Issue: "Only resolved complaints can be reappealed"
- **Solution**: Make sure complaint status is exactly "Resolved" (case-sensitive)

### Issue: Duplicate check not working
- **Solution**: Check if complaints are within 24 hours AND same category/ward

### Issue: Admin can't mark as resolved
- **Solution**: Old model didn't have afterImage field, update database schema

### Issue: Support button not working
- **Solution**: Ensure citizenEmail is being sent in request body

---

## 📝 Files Modified

| File | Changes |
|------|---------|
| `backend/models/Complaint.js` | Added 10+ new fields, updated enums |
| `backend/server.js` | Added 5 new routes, updated 3 existing routes |
| `frontend/complaint-detail.html` | Added reappeal UI, resolution review, satisfaction dialog |
| `frontend/citizen-dashboard.html` | Added duplicate detection, support system |
| `frontend/admin-dashboard.html` | Enhanced complaint cards, status management |

---

## 🎯 Key Improvements

✅ **Citizen Empowerment**: Citizens can reopen and provide feedback if unsatisfied
✅ **Better Accountability**: Admin must provide evidence (after-image) of resolution
✅ **Crowd Support**: Multiple citizens can support same complaint
✅ **Duplicate Prevention**: Prevents redundant complaints
✅ **Improved SLA**: Reappeal resets SLA tracking for reopened complaints
✅ **User Satisfaction**: Ensures citizens are satisfied before closing
✅ **Better UI/UX**: Clear status indicators and workflow visualization

---

## 📞 Support

For issues or questions, please refer to the API documentation or check the browser console for error messages.

**Last Updated**: March 8, 2026
**Version**: 2.0.0

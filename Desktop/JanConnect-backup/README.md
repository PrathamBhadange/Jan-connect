# JanConnect - Smart Civic Solutions

A civic grievance management system that connects citizens with local government for efficient complaint resolution.

## 📁 Project Structure

```
JanConnect/
├── backend/
│   ├── models/
│   │   ├── User.js          # User schema (Mongoose)
│   │   └── Complaint.js     # Complaint schema (Mongoose)
│   ├── server.js            # Express server & API routes
│   ├── package.json         # Backend dependencies
│   └── .env                 # Environment variables (not tracked)
├── frontend/
│   ├── login.html           # Login page
│   ├── register.html        # Create Account page
│   ├── citizen-dashboard.html  # Citizen dashboard
│   ├── admin-dashboard.html    # Admin dashboard
│   ├── complaint-detail.html   # Complaint details view
│   ├── appeal-detail.html      # ✨ NEW: Appeal & satisfaction review page
│   ├── style.css            # Login page styles
│   ├── register-style.css   # Registration page styles
│   ├── dashboard.css        # Dashboard styles
│   ├── script.js            # Login page logic
│   ├── register.js          # Registration page logic
│   ├── dashboard.js         # Dashboard logic
│   └── logo.png             # Application logo
├── .gitignore
├── README.md
├── FEATURE_UPDATES.md
└── APPEAL_REAPPEAL_FEATURE.md  # ✨ NEW: Complete feature documentation
```

## ⚙️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas (Mongoose ODM)
- **Authentication:** bcrypt.js for password hashing

## 🚀 Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB Atlas account (or local MongoDB)

### Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/PrathamBhadange/JanConnect.git
   cd JanConnect
   ```

2. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   ```

3. **Create a `.env` file** in `backend/`:

   ```
   MONGODB_URI=your_mongodb_connection_string
   PORT=5000
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

5. **Open the app:**
   Navigate to `http://localhost:5000` in your browser.

## 📋 Features

- **User Registration** with Aadhar verification, PAN, and additional citizen details
- **Role-based Login** (Citizen / Admin)
- **Citizen Dashboard** — File and track grievances
- **Admin Dashboard** — Manage complaints, update statuses, view all users
- **Complaint Management** — Categorized complaints with status tracking
- **✨ NEW: Appeal & Reappeal System** — Resolution review and satisfaction feedback
  - Users can review resolutions with before/after evidence images
  - Confirm satisfaction to close complaint or request review if unsatisfied
  - Admins cannot change resolved complaint status until user confirms satisfaction
  - Visual indicators show satisfaction status in admin dashboard
  - Automatic SLA reset when complaint is reopened
- **SLA Tracking** — Automatic escalation after 24 hours
- **Real-time Status Updates** — Immediate feedback across dashboards

## 📄 License

This project is for educational purposes.

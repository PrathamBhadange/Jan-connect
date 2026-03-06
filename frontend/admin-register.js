const API_BASE = 'http://localhost:5000/api';

function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    field.type = field.type === "password" ? "text" : "password";
}

document.getElementById("adminRegisterForm").addEventListener("submit", async function(e){
    e.preventDefault();
    
    // Personal Info
    const firstName = document.getElementById("firstName").value.trim();
    const middleName = document.getElementById("middleName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const phone = document.getElementById("phone").value.trim();
    const mobile = document.getElementById("mobile").value.trim();

    // Department Details
    const employeeId = document.getElementById("employeeId").value.trim();
    const department = document.getElementById("department").value;
    const designation = document.getElementById("designation").value.trim();
    const officeLocation = document.getElementById("officeLocation").value.trim();
    const jurisdiction = document.getElementById("jurisdiction").value.trim();
    const officeAddress = document.getElementById("officeAddress").value.trim();

    const message = document.getElementById("message");
    
    // Build full name
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

    // ---- Validations ----
    if (!firstName || !lastName) {
        message.style.color = "red";
        message.innerHTML = "First Name and Last Name are required!";
        return;
    }

    if (!email) {
        message.style.color = "red";
        message.innerHTML = "Official Email Address is required!";
        return;
    }

    if (password !== confirmPassword) {
        message.style.color = "red";
        message.innerHTML = "Passwords do not match!";
        return;
    }

    if (password.length < 6) {
        message.style.color = "red";
        message.innerHTML = "Password must be at least 6 characters!";
        return;
    }

    if (!mobile) {
        message.style.color = "red";
        message.innerHTML = "Mobile Number is required!";
        return;
    }

    if (!employeeId) {
        message.style.color = "red";
        message.innerHTML = "Employee ID is required!";
        return;
    }

    if (!department) {
        message.style.color = "red";
        message.innerHTML = "Please select a Department!";
        return;
    }

    if (!designation) {
        message.style.color = "red";
        message.innerHTML = "Designation is required!";
        return;
    }

    if (!officeLocation) {
        message.style.color = "red";
        message.innerHTML = "Office Location is required!";
        return;
    }

    message.style.color = "#555";
    message.innerHTML = "Registering admin account...";

    try {
        const res = await fetch(API_BASE + '/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName,
                firstName,
                middleName,
                lastName,
                email,
                phone,
                mobile,
                location: officeLocation,
                aadhar: '',
                role: 'admin',
                password,
                // Admin-specific fields
                employeeId,
                department,
                designation,
                officeLocation,
                jurisdiction,
                officeAddress
            })
        });

        const data = await res.json();

        if (res.ok) {
            message.style.color = "green";
            message.innerHTML = "Admin Registration Successful! Redirecting to login...";
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1500);
        } else {
            message.style.color = "red";
            message.innerHTML = data.error || "Registration failed!";
        }
    } catch(err) {
        message.style.color = "red";
        message.innerHTML = "Server unavailable. Please try again later.";
        console.error('Admin registration error:', err);
    }
});

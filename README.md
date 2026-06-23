# Redhope Server

This is the backend server for the Redhope application.

**Live Server Link:** [https://redhope-server.vercel.app/](https://redhope-server.vercel.app/)

## API Endpoints

- **POST `/funding`**: Create a new funding record.
- **GET `/funding`**: Fetch all funding records.
- **GET `/users`**: Fetch all users (Admin only).
- **GET `/users/search`**: Search active donors by blood group, district, and upazila.
- **GET `/users/:id`**: Fetch a single user by ID.
- **PATCH `/users/:id/status`**: Block or unblock a user (Admin only).
- **PATCH `/users/:id/role`**: Update a user's role (Admin only).
- **PATCH `/users/:id/profile`**: Update a user's profile details.
- **POST `/donation-requests`**: Create a new blood donation request.
- **GET `/donation-requests`**: Fetch all donation requests.
- **GET `/donation-requests/my/:email`**: Fetch donation requests made by a specific email.
- **GET `/donation-requests/:id`**: Fetch a single donation request by ID.
- **PATCH `/donation-requests/:id`**: Update an existing donation request details.
- **PATCH `/donation-requests/:id/status`**: Update the status of a donation request.
- **DELETE `/donation-requests/:id`**: Delete a donation request.
- **GET `/admin/stats`**: Fetch overview statistics for the admin/volunteer dashboard.
- **GET `/`**: Root endpoint to check server health.

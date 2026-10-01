# Hospital Management System

A comprehensive hospital management system built with Node.js, Express, MySQL, and a modern web interface. This system handles patient management, room availability, billing, appointments, and provides advanced SQL querying capabilities.

## Features

### Core Functionality
- **Patient Management**: Complete CRUD operations for patient records
- **Appointment Scheduling**: Schedule and manage doctor appointments
- **Room Management**: Track room availability and occupancy
- **Billing System**: Generate and track bills with payment status
- **User Authentication**: Secure login system with role-based access
- **Dashboard**: Real-time statistics and quick actions

### Advanced SQL Features
- **Complex Queries**: SELECT with WHERE, ORDER BY, and aggregate functions
- **Joins**: Inner, outer, and self joins for data relationships
- **Subqueries**: Nested queries for advanced data retrieval
- **Views**: Pre-defined views for common queries
- **Indexing**: Optimized database performance with proper indexing
- **Reports**: Comprehensive reporting with analytics

### Database Schema
The system includes the following main tables:
- `users` - User authentication and roles
- `patients` - Patient information and medical history
- `doctors` - Doctor profiles and specializations
- `rooms` - Room details and availability
- `appointments` - Appointment scheduling
- `room_assignments` - Patient room assignments
- `bills` - Billing and payment tracking
- `bill_items` - Detailed bill line items
- `medical_records` - Patient medical records

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hospital-management-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
1. Create a MySQL database:
```sql
CREATE DATABASE hospital_management;
```

2. Update the database configuration in `config.env`:
```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=hospital_management
PORT=3000
JWT_SECRET=your_jwt_secret_key
```

3. Import the database schema:
```bash
mysql -u your_username -p hospital_management < database/schema.sql
```

### 4. Start the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## Default Login Credentials

The system comes with pre-configured users:

| Username | Password | Role |
|----------|----------|------|
| admin | password | Admin |
| dr_smith | password | Doctor |
| nurse_jones | password | Nurse |

**Note**: Change these credentials in production!

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Patients
- `GET /api/patients` - Get all patients (with pagination and search)
- `GET /api/patients/:id` - Get specific patient
- `POST /api/patients` - Create new patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Appointments
- `GET /api/appointments` - Get appointments (with filters)
- `POST /api/appointments` - Schedule appointment

### Rooms
- `GET /api/rooms` - Get rooms (with filters)
- `POST /api/rooms` - Add new room

### Billing
- `GET /api/bills` - Get bills (with filters)

### Reports
- `GET /api/reports/patient-summary` - Patient summary report
- `GET /api/reports/room-occupancy` - Room occupancy report
- `GET /api/reports/doctor-workload` - Doctor workload report
- `GET /api/reports/revenue-analysis` - Revenue analysis report

## Advanced SQL Queries Examples

### 1. Complex Joins
```sql
SELECT 
    p.first_name, p.last_name,
    d.first_name as doctor_name, d.specialization,
    a.appointment_date, a.appointment_time
FROM appointments a
INNER JOIN patients p ON a.patient_id = p.patient_id
INNER JOIN doctors d ON a.doctor_id = d.doctor_id
WHERE a.status = 'Scheduled';
```

### 2. Aggregate Functions
```sql
SELECT 
    DATE_FORMAT(bill_date, '%Y-%m') as month,
    SUM(total_amount) as total_revenue,
    AVG(total_amount) as avg_bill,
    COUNT(*) as total_bills
FROM bills
GROUP BY DATE_FORMAT(bill_date, '%Y-%m')
ORDER BY month DESC;
```

### 3. Subqueries
```sql
SELECT p.*, b.balance_amount
FROM patients p
WHERE p.patient_id IN (
    SELECT patient_id 
    FROM bills 
    WHERE payment_status != 'Paid'
);
```

### 4. Views
The system includes several pre-defined views:
- `patient_appointments_view` - Patient appointments with doctor details
- `room_occupancy_view` - Room occupancy status
- `billing_summary_view` - Billing summary with patient details

## Database Indexing

The database includes optimized indexes for:
- Patient name searches
- Appointment date filtering
- Room availability queries
- Billing status filtering
- Medical record lookups

## Features in Detail

### Patient Management
- Complete patient profiles with medical history
- Emergency contact information
- Blood type and allergy tracking
- Search and filter capabilities
- Pagination for large datasets

### Appointment System
- Doctor availability tracking
- Appointment scheduling with time slots
- Status management (Scheduled, Confirmed, Completed, Cancelled)
- Patient and doctor selection

### Room Management
- Room type categorization (General, Private, ICU, Emergency, Surgery)
- Real-time occupancy tracking
- Floor-based organization
- Daily rate management

### Billing System
- Itemized billing with detailed breakdowns
- Payment tracking (Paid, Unpaid, Partially Paid)
- Balance calculation
- Due date management

### Reporting & Analytics
- Patient summary reports
- Room occupancy analysis
- Doctor workload statistics
- Revenue analysis with monthly trends
- Real-time dashboard metrics

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation and sanitization
- SQL injection prevention

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL 8.0
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Bootstrap 5
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.

## Future Enhancements

- Real-time notifications
- Email/SMS integration
- Advanced reporting with charts
- Mobile application
- Integration with medical devices
- Prescription management
- Inventory management

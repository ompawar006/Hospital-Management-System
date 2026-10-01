-- Hospital Management System Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS hospital_management;
USE hospital_management;

-- Users table (for authentication)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'doctor', 'nurse', 'receptionist') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User roles table (enumeration of roles)
CREATE TABLE user_roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    phone VARCHAR(15),
    email VARCHAR(100),
    address TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(15),
    blood_type ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
    medical_history TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_patient_name (first_name, last_name),
    INDEX idx_patient_phone (phone),
    INDEX idx_patient_email (email)
);

-- Doctors table
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    phone VARCHAR(15),
    email VARCHAR(100),
    license_number VARCHAR(50) UNIQUE,
    consultation_fee DECIMAL(10,2),
    available_days JSON,
    available_hours JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_doctor_specialization (specialization),
    INDEX idx_doctor_name (first_name, last_name)
);

-- Rooms table
CREATE TABLE rooms (
    room_id INT PRIMARY KEY AUTO_INCREMENT,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    room_type ENUM('General', 'Private', 'ICU', 'Emergency', 'Surgery') NOT NULL,
    floor_number INT NOT NULL,
    bed_capacity INT DEFAULT 1,
    current_occupancy INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    room_charge_per_day DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_room_type (room_type),
    INDEX idx_room_availability (is_available),
    INDEX idx_room_floor (floor_number)
);

-- Appointments table
CREATE TABLE appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status ENUM('Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Scheduled',
    reason_for_visit TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    INDEX idx_appointment_date (appointment_date),
    INDEX idx_appointment_status (status),
    INDEX idx_appointment_patient (patient_id),
    INDEX idx_appointment_doctor (doctor_id)
);

-- Room assignments table
CREATE TABLE room_assignments (
    assignment_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    room_id INT NOT NULL,
    admission_date DATETIME NOT NULL,
    discharge_date DATETIME NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE,
    INDEX idx_assignment_patient (patient_id),
    INDEX idx_assignment_room (room_id),
    INDEX idx_assignment_active (is_active)
);

-- Bills table
CREATE TABLE bills (
    bill_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    appointment_id INT NULL,
    room_assignment_id INT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0.00,
    balance_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    payment_status ENUM('Unpaid', 'Partially Paid', 'Paid') DEFAULT 'Unpaid',
    bill_date DATE NOT NULL,
    due_date DATE,
    payment_date DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    FOREIGN KEY (room_assignment_id) REFERENCES room_assignments(assignment_id) ON DELETE SET NULL,
    INDEX idx_bill_patient (patient_id),
    INDEX idx_bill_status (payment_status),
    INDEX idx_bill_date (bill_date)
);

-- Bill items table (for detailed billing)
CREATE TABLE bill_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    bill_id INT NOT NULL,
    item_description VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE,
    INDEX idx_bill_item_bill (bill_id)
);

-- Medical records table
CREATE TABLE medical_records (
    record_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_id INT NULL,
    diagnosis TEXT,
    treatment_plan TEXT,
    prescription TEXT,
    vital_signs JSON,
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    INDEX idx_record_patient (patient_id),
    INDEX idx_record_doctor (doctor_id),
    INDEX idx_record_date (created_at)
);

-- Create views for common queries
-- View for patient appointments with doctor details
CREATE VIEW patient_appointments_view AS
SELECT 
    a.appointment_id,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    p.phone AS patient_phone,
    d.first_name AS doctor_first_name,
    d.last_name AS doctor_last_name,
    d.specialization,
    a.appointment_date,
    a.appointment_time,
    a.status,
    a.reason_for_visit
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
JOIN doctors d ON a.doctor_id = d.doctor_id;

-- View for room occupancy
CREATE VIEW room_occupancy_view AS
SELECT 
    r.room_id,
    r.room_number,
    r.room_type,
    r.floor_number,
    r.bed_capacity,
    r.current_occupancy,
    (r.bed_capacity - r.current_occupancy) AS available_beds,
    r.is_available,
    r.room_charge_per_day
FROM rooms r;

-- View for billing summary
CREATE VIEW billing_summary_view AS
SELECT 
    b.bill_id,
    p.first_name AS patient_first_name,
    p.last_name AS patient_last_name,
    b.total_amount,
    b.paid_amount,
    b.balance_amount,
    b.payment_status,
    b.bill_date,
    b.due_date,
    b.payment_date
FROM bills b
JOIN patients p ON b.patient_id = p.patient_id;

-- Insert sample data
-- Insert sample users
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@hospital.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('dr_smith', 'dr.smith@hospital.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'doctor'),
('nurse_jones', 'nurse.jones@hospital.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'nurse');

-- Insert sample doctors
INSERT INTO doctors (user_id, first_name, last_name, specialization, phone, email, license_number, consultation_fee, available_days, available_hours) VALUES
(2, 'John', 'Smith', 'Cardiology', '555-0101', 'dr.smith@hospital.com', 'MD123456', 150.00, '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]', '{"start": "09:00", "end": "17:00"}'),
(3, 'Sarah', 'Johnson', 'Pediatrics', '555-0102', 'sarah.johnson@hospital.com', 'MD123457', 120.00, '["Monday", "Wednesday", "Friday"]', '{"start": "10:00", "end": "16:00"}');

-- Additional doctors added for more scheduling options
INSERT INTO doctors (user_id, first_name, last_name, specialization, phone, email, license_number, consultation_fee, available_days, available_hours) VALUES
 (NULL, 'James', 'Williams', 'Cardiology', '555-0110', 'james.williams@hospital.com', 'MD123458', 160.00, '["Monday","Tuesday","Thursday"]', '{"start":"09:00","end":"15:00"}'),
 (NULL, 'Emma', 'Brown', 'Neurology', '555-0111', 'emma.brown@hospital.com', 'MD123459', 170.00, '["Tuesday","Wednesday","Friday"]', '{"start":"10:00","end":"16:00"}'),
 (NULL, 'Michael', 'Davis', 'Orthopedics', '555-0112', 'michael.davis@hospital.com', 'MD123460', 140.00, '["Monday","Wednesday","Friday"]', '{"start":"08:00","end":"14:00"}'),
 (NULL, 'Lisa', 'Miller', 'Dermatology', '555-0113', 'lisa.miller@hospital.com', 'MD123461', 110.00, '["Tuesday","Thursday"]', '{"start":"11:00","end":"17:00"}'),
 (NULL, 'Robert', 'Wilson', 'Internal Medicine', '555-0114', 'robert.wilson@hospital.com', 'MD123462', 130.00, '["Monday","Tuesday","Wednesday"]', '{"start":"09:00","end":"17:00"}'),
 (NULL, 'Jennifer', 'Taylor', 'Ophthalmology', '555-0115', 'jennifer.taylor@hospital.com', 'MD123463', 125.00, '["Monday","Thursday"]', '{"start":"10:00","end":"16:00"}'),
 (NULL, 'David', 'Anderson', 'ENT', '555-0116', 'david.anderson@hospital.com', 'MD123464', 115.00, '["Wednesday","Friday"]', '{"start":"09:00","end":"14:00"}'),
 (NULL, 'Mary', 'Thomas', 'Gynecology', '555-0117', 'mary.thomas@hospital.com', 'MD123465', 150.00, '["Tuesday","Thursday"]', '{"start":"09:00","end":"15:00"}'),
 (NULL, 'John', 'Moore', 'Psychiatry', '555-0118', 'john.moore@hospital.com', 'MD123466', 145.00, '["Monday","Wednesday"]', '{"start":"10:00","end":"16:00"}'),
 (NULL, 'Patricia', 'Martin', 'Pediatric Surgery', '555-0119', 'patricia.martin@hospital.com', 'MD123467', 200.00, '["Tuesday","Friday"]', '{"start":"08:00","end":"12:00"}'),
 (NULL, 'Richard', 'Lee', 'Cardiothoracic Surgery', '555-0120', 'richard.lee@hospital.com', 'MD123468', 220.00, '["Monday","Thursday"]', '{"start":"09:00","end":"13:00"}'),
 (NULL, 'Sandra', 'Garcia', 'Endocrinology', '555-0121', 'sandra.garcia@hospital.com', 'MD123469', 135.00, '["Wednesday","Thursday"]', '{"start":"10:00","end":"16:00"}'),
 (NULL, 'Joseph', 'Rodriguez', 'Gastroenterology', '555-0122', 'joseph.rodriguez@hospital.com', 'MD123470', 150.00, '["Monday","Friday"]', '{"start":"11:00","end":"17:00"}'),
 (NULL, 'Nancy', 'Martinez', 'Oncology', '555-0123', 'nancy.martinez@hospital.com', 'MD123471', 210.00, '["Tuesday","Thursday"]', '{"start":"09:00","end":"15:00"}'),
 (NULL, 'Steven', 'Hernandez', 'Urology', '555-0124', 'steven.hernandez@hospital.com', 'MD123472', 155.00, '["Monday","Wednesday"]', '{"start":"10:00","end":"16:00"}'),
 (NULL, 'Elizabeth', 'Young', 'Rheumatology', '555-0125', 'elizabeth.young@hospital.com', 'MD123473', 140.00, '["Tuesday","Friday"]', '{"start":"09:00","end":"14:00"}'),
 (NULL, 'Christopher', 'King', 'Pulmonology', '555-0126', 'christopher.king@hospital.com', 'MD123474', 160.00, '["Wednesday","Friday"]', '{"start":"11:00","end":"17:00"}'),
 (NULL, 'Margaret', 'Wright', 'Nephrology', '555-0127', 'margaret.wright@hospital.com', 'MD123475', 170.00, '["Monday","Thursday"]', '{"start":"09:00","end":"15:00"}'),
 (NULL, 'Daniel', 'Lopez', 'General Surgery', '555-0128', 'daniel.lopez@hospital.com', 'MD123476', 190.00, '["Tuesday","Wednesday"]', '{"start":"08:00","end":"14:00"}');

-- Insert sample patients
INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, email, address, emergency_contact_name, emergency_contact_phone, blood_type, medical_history) VALUES
('Alice', 'Brown', '1985-03-15', 'Female', '555-1001', 'alice.brown@email.com', '123 Main St, City', 'Bob Brown', '555-1002', 'A+', 'No significant medical history'),
('Charlie', 'Davis', '1978-07-22', 'Male', '555-1003', 'charlie.davis@email.com', '456 Oak Ave, City', 'Diana Davis', '555-1004', 'O-', 'Diabetes Type 2'),
('Emma', 'Wilson', '1992-11-08', 'Female', '555-1005', 'emma.wilson@email.com', '789 Pine Rd, City', 'Frank Wilson', '555-1006', 'B+', 'Allergic to penicillin');

-- Insert sample rooms
INSERT INTO rooms (room_number, room_type, floor_number, bed_capacity, current_occupancy, is_available, room_charge_per_day) VALUES
('101', 'General', 1, 2, 1, FALSE, 200.00),
('102', 'General', 1, 2, 0, TRUE, 200.00),
('201', 'Private', 2, 1, 0, TRUE, 500.00),
('301', 'ICU', 3, 1, 1, FALSE, 1000.00),
('401', 'Surgery', 4, 1, 0, TRUE, 800.00);

-- Insert sample appointments
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status, reason_for_visit) VALUES
(1, 1, '2024-01-15', '10:00:00', 'Scheduled', 'Regular checkup'),
(2, 1, '2024-01-15', '11:00:00', 'Confirmed', 'Heart condition follow-up'),
(3, 2, '2024-01-16', '14:00:00', 'Scheduled', 'Child health checkup');

-- Insert sample room assignments
INSERT INTO room_assignments (patient_id, room_id, admission_date, is_active) VALUES
(1, 1, '2024-01-10 08:00:00', TRUE),
(2, 4, '2024-01-12 10:30:00', TRUE);

-- Insert sample bills
INSERT INTO bills (patient_id, appointment_id, total_amount, paid_amount, payment_status, bill_date, due_date) VALUES
(1, 1, 300.00, 150.00, 'Partially Paid', '2024-01-15', '2024-02-15'),
(2, 2, 450.00, 0.00, 'Unpaid', '2024-01-15', '2024-02-15'),
(1, NULL, 1000.00, 1000.00, 'Paid', '2024-01-10', '2024-01-20');

-- Insert sample bill items
INSERT INTO bill_items (bill_id, item_description, quantity, unit_price) VALUES
(1, 'Consultation Fee', 1, 150.00),
(1, 'Lab Tests', 1, 150.00),
(2, 'Consultation Fee', 1, 150.00),
(2, 'ECG', 1, 200.00),
(2, 'Blood Test', 1, 100.00),
(3, 'Room Charges (5 days)', 5, 200.00);

-- Departments (for staff and doctors)
CREATE TABLE departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    head_staff_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff table for hospital employees (doctors are separate but can also be linked)
CREATE TABLE staff (
    staff_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    department_id INT NULL,
    phone VARCHAR(15),
    email VARCHAR(100),
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL,
    INDEX idx_staff_role (role),
    INDEX idx_staff_name (first_name, last_name)
);

-- Now add the department head foreign key after staff table exists
ALTER TABLE departments 
ADD FOREIGN KEY (head_staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL;

-- Admissions (separate from room assignments, for tracking admissions/discharges)
CREATE TABLE IF NOT EXISTS admissions (
    admission_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    admitted_by_staff_id INT NULL,
    admission_date DATETIME NOT NULL,
    admission_reason TEXT,
    discharge_date DATETIME NULL,
    discharge_summary TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (admitted_by_staff_id) REFERENCES staff(staff_id) ON DELETE SET NULL,
    INDEX idx_admission_patient (patient_id),
    INDEX idx_admission_active (is_active)
);

-- Emergency contacts (separate table for patients with multiple contacts)
CREATE TABLE IF NOT EXISTS emergency_contacts (
    contact_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50),
    phone VARCHAR(15),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    INDEX idx_emergency_patient (patient_id)
);

-- Lab tests and results
CREATE TABLE IF NOT EXISTS lab_tests (
    test_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    ordered_by_doctor_id INT NULL,
    appointment_id INT NULL,
    test_type VARCHAR(150) NOT NULL,
    sample_collected_at DATETIME NULL,
    result_text TEXT,
    result_file VARCHAR(255),
    status ENUM('Ordered', 'Sample Collected', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Ordered',
    ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    result_at DATETIME NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (ordered_by_doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    INDEX idx_lab_patient (patient_id),
    INDEX idx_lab_status (status)
);

-- Medications master list
CREATE TABLE IF NOT EXISTS medications (
    medication_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_med_name (name)
);

-- Prescriptions (header) and prescription items (medication lines)
CREATE TABLE IF NOT EXISTS prescriptions (
    prescription_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_id INT NULL,
    prescribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    INDEX idx_prescription_patient (patient_id),
    INDEX idx_prescription_doctor (doctor_id)
);

CREATE TABLE IF NOT EXISTS prescription_items (
    prescription_item_id INT PRIMARY KEY AUTO_INCREMENT,
    prescription_id INT NOT NULL,
    medication_id INT NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(medication_id) ON DELETE RESTRICT,
    INDEX idx_prescription_item_med (medication_id)
);

-- Payments table (payments for bills)
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    bill_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method ENUM('Cash','Card','Online','Insurance','Other') DEFAULT 'Cash',
    reference VARCHAR(255),
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE,
    INDEX idx_payment_bill (bill_id),
    INDEX idx_payment_date (payment_date)
);

-- Ensure users, patients, rooms, appointments, bills, bill_items, medical_records exist (they do in this file)

-- Sample inserts for departments, roles and some staff
INSERT INTO user_roles (role_name, description) VALUES
('admin','System administrator with full privileges'),
('receptionist','Front-desk staff handling appointments and patient intake'),
('nurse','Nursing staff'),
('doctor','Physician');

INSERT INTO departments (name, description) VALUES
('Cardiology', 'Heart and vascular department'),
('Pediatrics', 'Child health department'),
('Emergency', 'Emergency and trauma');

INSERT INTO staff (user_id, first_name, last_name, role, department_id, phone, email, hire_date) VALUES
(NULL, 'Alice', 'Walker', 'Receptionist', 3, '555-0201', 'alice.walker@hospital.com', '2020-05-01'),
(NULL, 'Greg', 'House', 'Nurse', 1, '555-0202', 'greg.house@hospital.com', '2018-09-15');

-- Example medication entries
INSERT INTO medications (name, description, unit_price) VALUES
('Paracetamol', 'Analgesic and antipyretic', 0.50),
('Amoxicillin', 'Antibiotic', 1.20),
('Atorvastatin', 'Cholesterol lowering agent', 0.90);

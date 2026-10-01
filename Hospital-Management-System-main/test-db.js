#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hospital_management'
};

async function testDatabase() {
    let connection;
    
    try {
        console.log(' Testing database connection...');
        connection = await mysql.createConnection(dbConfig);
        
        console.log(' Database connection successful!');
        
        // Test basic queries
        console.log('\n Testing database queries...');
        
        // Test patient count
        const [patients] = await connection.execute('SELECT COUNT(*) as count FROM patients');
        console.log(` Patients in database: ${patients[0].count}`);
        
        // Test doctors count
        const [doctors] = await connection.execute('SELECT COUNT(*) as count FROM doctors');
        console.log(` Doctors in database: ${doctors[0].count}`);
        
        // Test rooms count
        const [rooms] = await connection.execute('SELECT COUNT(*) as count FROM rooms');
        console.log(` Rooms in database: ${rooms[0].count}`);
        
        // Test appointments count
        const [appointments] = await connection.execute('SELECT COUNT(*) as count FROM appointments');
        console.log(` Appointments in database: ${appointments[0].count}`);
        
        // Test complex query (patient summary view)
        console.log('\n Testing complex queries...');
        const [patientSummary] = await connection.execute(`
            SELECT 
                p.patient_id,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                COUNT(DISTINCT a.appointment_id) as total_appointments,
                COALESCE(SUM(b.total_amount), 0) as total_bills
            FROM patients p
            LEFT JOIN appointments a ON p.patient_id = a.patient_id
            LEFT JOIN bills b ON p.patient_id = b.patient_id
            GROUP BY p.patient_id, p.first_name, p.last_name
            LIMIT 5
        `);
        
        console.log(' Patient Summary (first 5):');
        patientSummary.forEach(patient => {
            console.log(`  - ${patient.patient_name}: ${patient.total_appointments} appointments, $${patient.total_bills} total bills`);
        });
        
        // Test views
        console.log('\n Testing database views...');
        const [roomOccupancy] = await connection.execute('SELECT * FROM room_occupancy_view LIMIT 3');
        console.log(' Room Occupancy View (first 3):');
        roomOccupancy.forEach(room => {
            console.log(`  - Room ${room.room_number} (${room.room_type}): ${room.available_beds} available beds`);
        });
        
        console.log('\n All database tests passed!');
        console.log(' Your hospital management system is ready to use!');
        
    } catch (error) {
        console.error(' Database test failed:', error.message);
        console.log('\n Troubleshooting:');
        console.log('1. Make sure MySQL is running');
        console.log('2. Check your database credentials in config.env');
        console.log('3. Run setup.js first to create the database');
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testDatabase();

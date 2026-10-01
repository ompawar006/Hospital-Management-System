const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static('public'));

// Route for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        const connection = await pool.getConnection();
        await connection.ping();
        
        // Get some basic stats
        const [roomStats] = await connection.execute('SELECT COUNT(*) as total, SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as available FROM rooms');
        const [patientStats] = await connection.execute('SELECT COUNT(*) as total FROM patients');
        const [assignmentStats] = await connection.execute('SELECT COUNT(*) as total FROM room_assignments WHERE is_active = 1');
        
        connection.release();
        
        res.json({
            status: 'healthy',
            database: 'connected',
            stats: {
                rooms: roomStats[0],
                patients: patientStats[0],
                activeAssignments: assignmentStats[0]
            }
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message
        });
    }
});

// Database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: 'root123',
    database: process.env.DB_NAME || 'hospital_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log('Database config:', {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database
});

const pool = mysql.createPool(dbConfig);

// Test database connection
pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });

// JWT middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.user_id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Patient routes
app.get('/api/patients', authenticateToken, async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;
        
        // Debug: log request info
        console.log('GET /api/patients:', {
            auth: req.headers.authorization ? 'present' : 'missing',
            search, page, limit
        });
        
        let query = 'SELECT * FROM patients';
        let params = [];
        
        if (search) {
            query += ' WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?';
            const searchTerm = `%${search}%`;
            params = [searchTerm, searchTerm, searchTerm, searchTerm];
        }
        
        query += ' ORDER BY created_at DESC';
        
        // LIMIT and OFFSET cannot be bound as parameters in mysql2
        // Safely validate and use template literals for LIMIT/OFFSET
        const limitNum = Math.max(1, parseInt(limit) || 10);
        const offsetNum = Math.max(0, parseInt(offset) || 0);
        
        // Use query() with SQL escaping for LIMIT/OFFSET
        const fullQuery = query + ` LIMIT ${limitNum} OFFSET ${offsetNum}`;
        
        // Debug: log query
        console.log('Query:', fullQuery, 'Params:', params);
        
        // Execute query
        const result = await pool.query(fullQuery, params);
        const rows = result[0];
        console.log(`Found ${rows.length} patients`);
        
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM patients';
        let countParams = [];
        
        if (search) {
            countQuery += ' WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?';
            const searchTerm = `%${search}%`;
            countParams = [searchTerm, searchTerm, searchTerm, searchTerm];
        }
        
        const [countResult] = await pool.execute(countQuery, countParams);
        const total = countResult[0].total;
        
        const response = {
            patients: rows,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        };
        
        // Debug: log response
        console.log('Sending response:', {
            patientCount: rows.length,
            pagination: response.pagination
        });
        
        res.json(response);
    } catch (error) {
        console.error('Get patients error:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message, // Send error details in development
            code: error.code
        });
    }
});

app.get('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Fetching patient details for ID:', id);
        
        const [rows] = await pool.execute(
            'SELECT patient_id, first_name, last_name, date_of_birth, gender, phone, email, address, ' +
            'emergency_contact_name, emergency_contact_phone, blood_type, medical_history ' +
            'FROM patients WHERE patient_id = ?',
            [id]
        );
        
        if (rows.length === 0) {
            console.log('Patient not found:', id);
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        // Convert date format for the client
        const patient = rows[0];
        if (patient.date_of_birth) {
            patient.date_of_birth = patient.date_of_birth.toISOString().split('T')[0];
        }
        
        console.log('Found patient:', patient);
        res.json(patient);
    } catch (error) {
        console.error('Get patient error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
    try {
        const {
            first_name, last_name, date_of_birth, gender, phone, email,
            address, emergency_contact_name, emergency_contact_phone,
            blood_type, medical_history
        } = req.body;
        
        const [result] = await pool.execute(
            `INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone, email, 
             address, emergency_contact_name, emergency_contact_phone, blood_type, medical_history) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [first_name, last_name, date_of_birth, gender, phone, email,
             address, emergency_contact_name, emergency_contact_phone, blood_type, medical_history]
        );
        
        res.status(201).json({
            message: 'Patient created successfully',
            patientId: result.insertId
        });
    } catch (error) {
        console.error('Create patient error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            first_name, last_name, date_of_birth, gender, phone, email,
            address, emergency_contact_name, emergency_contact_phone,
            blood_type, medical_history
        } = req.body;
        
        const [result] = await pool.execute(
            `UPDATE patients SET first_name = ?, last_name = ?, date_of_birth = ?, 
             gender = ?, phone = ?, email = ?, address = ?, emergency_contact_name = ?, 
             emergency_contact_phone = ?, blood_type = ?, medical_history = ?, 
             updated_at = CURRENT_TIMESTAMP WHERE patient_id = ?`,
            [first_name, last_name, date_of_birth, gender, phone, email,
             address, emergency_contact_name, emergency_contact_phone, blood_type, 
             medical_history, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        res.json({ message: 'Patient updated successfully' });
    } catch (error) {
        console.error('Update patient error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await pool.execute(
            'DELETE FROM patients WHERE patient_id = ?',
            [id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
        console.error('Delete patient error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Room routes
app.get('/api/rooms', authenticateToken, async (req, res) => {
    try {
        const { type, available, floor } = req.query;
        
        let query = 'SELECT * FROM rooms WHERE 1=1';
        let params = [];
        
        if (type) {
            query += ' AND room_type = ?';
            params.push(type);
        }
        
        if (available !== undefined) {
            query += ' AND is_available = ?';
            params.push(available === 'true');
        }
        
        if (floor) {
            query += ' AND floor_number = ?';
            params.push(parseInt(floor));
        }
        
        query += ' ORDER BY room_number';
        
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add endpoint to get a single room by ID
app.get('/api/rooms/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Getting room details for ID:', id);

        const [rows] = await pool.execute(
            'SELECT * FROM rooms WHERE room_id = ?',
            [id]
        );

        if (rows.length === 0) {
            console.log('Room not found:', id);
            return res.status(404).json({ error: 'Room not found' });
        }

        console.log('Found room:', rows[0]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
    try {
        const {
            room_number, room_type, floor_number, bed_capacity,
            room_charge_per_day
        } = req.body;
        
        const [result] = await pool.execute(
            `INSERT INTO rooms (room_number, room_type, floor_number, bed_capacity, room_charge_per_day) 
             VALUES (?, ?, ?, ?, ?)`,
            [room_number, room_type, floor_number, bed_capacity, room_charge_per_day]
        );
        
        res.status(201).json({
            message: 'Room created successfully',
            roomId: result.insertId
        });
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add endpoint for updating room details
app.put('/api/rooms/:id', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const {
            room_number, room_type, floor_number, bed_capacity,
            room_charge_per_day
        } = req.body;

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Get current room details
        const [currentRoom] = await connection.execute(
            'SELECT * FROM rooms WHERE room_id = ? FOR UPDATE',
            [id]
        );

        if (currentRoom.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Room not found' });
        }

        // Check if room number is being changed and if it's already in use
        if (room_number !== currentRoom[0].room_number) {
            const [existingRoom] = await connection.execute(
                'SELECT room_id FROM rooms WHERE room_number = ? AND room_id != ?',
                [room_number, id]
            );
            
            if (existingRoom.length > 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Room number already exists' });
            }
        }

        // Validate bed capacity against current occupancy
        if (bed_capacity < currentRoom[0].current_occupancy) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Cannot reduce bed capacity below current occupancy' 
            });
        }

        // Update room details
        const [result] = await connection.execute(
            `UPDATE rooms 
             SET room_number = ?, 
                 room_type = ?, 
                 floor_number = ?, 
                 bed_capacity = ?,
                 room_charge_per_day = ?,
                 is_available = ?
             WHERE room_id = ?`,
            [
                room_number,
                room_type,
                floor_number,
                bed_capacity,
                room_charge_per_day,
                currentRoom[0].current_occupancy < bed_capacity,
                id
            ]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Room not found' });
        }

        await connection.commit();

        res.json({
            message: 'Room updated successfully',
            room: {
                room_id: id,
                room_number,
                room_type,
                floor_number,
                bed_capacity,
                room_charge_per_day,
                current_occupancy: currentRoom[0].current_occupancy,
                is_available: currentRoom[0].current_occupancy < bed_capacity
            }
        });
    } catch (error) {
        console.error('Update room error:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Room assignment routes
app.get('/api/room-assignments', authenticateToken, async (req, res) => {
    try {
        const { room_id, patient_id, active } = req.query;
        
        let query = `
            SELECT ra.*, 
                   r.room_number, r.room_type,
                   p.first_name as patient_first_name, p.last_name as patient_last_name,
                   p.phone as patient_phone
            FROM room_assignments ra
            JOIN rooms r ON ra.room_id = r.room_id
            JOIN patients p ON ra.patient_id = p.patient_id
            WHERE 1=1
        `;
        let params = [];
        
        if (room_id) {
            query += ' AND ra.room_id = ?';
            params.push(room_id);
        }
        
        if (patient_id) {
            query += ' AND ra.patient_id = ?';
            params.push(patient_id);
        }
        
        if (active !== undefined) {
            query += ' AND ra.is_active = ?';
            params.push(active === 'true');
        }
        
        query += ' ORDER BY ra.admission_date DESC';
        
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Get room assignments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/room-assignments', authenticateToken, async (req, res) => {
    try {
        const { room_id, patient_id, admission_date } = req.body;
        console.log('Creating room assignment:', { room_id, patient_id, admission_date });

        // Input validation
        if (!room_id || !patient_id || !admission_date) {
            console.error('Missing required fields:', { room_id, patient_id, admission_date });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify patient exists
        const [patientRows] = await pool.execute(
            'SELECT * FROM patients WHERE patient_id = ?',
            [patient_id]
        );

        if (patientRows.length === 0) {
            console.error('Patient not found:', patient_id);
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Get room details with explicit locking
        const [roomRows] = await pool.execute(
            'SELECT room_number, bed_capacity, current_occupancy, room_charge_per_day FROM rooms WHERE room_id = ? FOR UPDATE',
            [room_id]
        );

        if (roomRows.length === 0) {
            console.error('Room not found:', room_id);
            return res.status(404).json({ error: 'Room not found' });
        }

        const room = roomRows[0];
        const roomNumber = room.room_number;

        console.log('Room details:', room);

        // Check if room is full
        if (room.current_occupancy >= room.bed_capacity) {
            console.error('Room is full:', { 
                room_id, 
                current_occupancy: room.current_occupancy, 
                bed_capacity: room.bed_capacity 
            });
            return res.status(400).json({ error: 'Room is at full capacity' });
        }

        // Check if patient is already assigned to an active room with detailed info
        const [existingAssignments] = await pool.execute(
            `SELECT ra.*, r.room_number 
             FROM room_assignments ra 
             JOIN rooms r ON ra.room_id = r.room_id 
             WHERE ra.patient_id = ? AND ra.is_active = 1`,
            [patient_id]
        );

        if (existingAssignments.length > 0) {
            const currentAssignment = existingAssignments[0];
            console.error('Patient already has active assignment:', {
                patient_id,
                current_room: currentAssignment.room_number,
                admission_date: currentAssignment.admission_date
            });
            return res.status(400).json({ 
                error: `Patient is already assigned to room ${currentAssignment.room_number}. Please discharge them first.` 
            });
        }

        // Start transaction
        const connection = await pool.getConnection();
        console.log('Starting transaction...');

        try {
            await connection.beginTransaction();

            // Create room assignment with proper date handling
            const [result] = await connection.execute(
                `INSERT INTO room_assignments (room_id, patient_id, admission_date, is_active) 
                 VALUES (?, ?, ?, true)`,
                [room_id, patient_id, admission_date]
            );

            console.log('Room assignment created:', result.insertId);

            // Update room occupancy with validation
            const newOccupancy = room.current_occupancy + 1;
            if (newOccupancy > room.bed_capacity) {
                throw new Error('Room capacity exceeded during update');
            }

            const isAvailable = newOccupancy < room.bed_capacity;
            await connection.execute(
                'UPDATE rooms SET current_occupancy = ?, is_available = ? WHERE room_id = ?',
                [newOccupancy, isAvailable, room_id]
            );

            console.log('Room occupancy updated:', { newOccupancy, isAvailable });

            // Generate bill for room charges
            const today = new Date().toISOString().split('T')[0];
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);

            const [billResult] = await connection.execute(
                `INSERT INTO bills (patient_id, room_assignment_id, total_amount, paid_amount, payment_status, bill_date, due_date) 
                 VALUES (?, ?, ?, 0.00, 'Unpaid', ?, ?)`,
                [patient_id, result.insertId, room.room_charge_per_day, today, dueDate.toISOString().split('T')[0]]
            );

            console.log('Bill created:', billResult.insertId);

            // Add bill item
            await connection.execute(
                `INSERT INTO bill_items (bill_id, item_description, quantity, unit_price) 
                 VALUES (?, ?, 1, ?)`,
                [billResult.insertId, `Room charges - Room ${roomNumber} (Day 1)`, room.room_charge_per_day]
            );

            console.log('Bill item added');

            // Double check the room assignment state
            const [verifyAssignment] = await connection.execute(
                'SELECT * FROM room_assignments WHERE assignment_id = ?',
                [result.insertId]
            );

            if (!verifyAssignment.length) {
                throw new Error('Room assignment verification failed');
            }

            await connection.commit();
            console.log('Transaction committed successfully');

            res.status(201).json({
                message: 'Patient assigned to room successfully',
                assignmentId: result.insertId,
                billId: billResult.insertId,
                roomNumber: roomNumber
            });
        } catch (transactionError) {
            console.error('Transaction failed:', {
                error: transactionError.message,
                stack: transactionError.stack,
                sql: transactionError.sql,
                sqlMessage: transactionError.sqlMessage
            });

            await connection.rollback();
            throw transactionError;
        } finally {
            connection.release();
            console.log('Connection released');
        }
    } catch (error) {
        console.error('Room assignment failed:', {
            error: error.message,
            stack: error.stack,
            sql: error.sql,
            sqlMessage: error.sqlMessage,
            code: error.code
        });

        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

app.put('/api/room-assignments/:id/discharge', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { discharge_date } = req.body;
        
        if (!discharge_date) {
            return res.status(400).json({ error: 'Discharge date is required' });
        }

        // Get connection for transaction
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // Get assignment details with room information
        const [assignmentRows] = await connection.execute(
            `SELECT ra.*, r.room_number, r.room_charge_per_day, r.current_occupancy,
                    p.first_name, p.last_name
             FROM room_assignments ra 
             JOIN rooms r ON ra.room_id = r.room_id 
             JOIN patients p ON ra.patient_id = p.patient_id
             WHERE ra.assignment_id = ? AND ra.is_active = 1
             FOR UPDATE`,
            [id]
        );
        
        if (assignmentRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Active assignment not found' });
        }
        
        const assignment = assignmentRows[0];
        console.log('Found assignment:', {
            assignmentId: id,
            roomNumber: assignment.room_number,
            patientName: `${assignment.first_name} ${assignment.last_name}`,
            admissionDate: assignment.admission_date
        });
        
        // Validate discharge date
        const admissionDate = new Date(assignment.admission_date);
        const dischargeDate = new Date(discharge_date);
        
        if (dischargeDate < admissionDate) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Discharge date cannot be earlier than admission date' 
            });
        }
        
        // Calculate stay duration and charges
        const daysStayed = Math.max(1, Math.ceil((dischargeDate - admissionDate) / (1000 * 60 * 60 * 24)));
        const totalCharges = daysStayed * assignment.room_charge_per_day;
        
        console.log('Calculated charges:', { daysStayed, totalCharges });
        
        // Update assignment to inactive
        const [updateResult] = await connection.execute(
            'UPDATE room_assignments SET is_active = 0, discharge_date = ? WHERE assignment_id = ? AND is_active = 1',
            [discharge_date, id]
        );
        
        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Assignment already discharged or not found' 
            });
        }
        
        // Update room occupancy
        await connection.execute(
            'UPDATE rooms SET current_occupancy = GREATEST(0, current_occupancy - 1), is_available = 1 WHERE room_id = ?',
            [assignment.room_id]
        );
        
        // Generate final bill
        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        const [billResult] = await connection.execute(
            `INSERT INTO bills (patient_id, room_assignment_id, total_amount, paid_amount, 
                              payment_status, bill_date, due_date) 
             VALUES (?, ?, ?, 0.00, 'Unpaid', ?, ?)`,
            [assignment.patient_id, id, totalCharges, today, dueDate.toISOString().split('T')[0]]
        );
        
        // Add bill item
        await connection.execute(
            `INSERT INTO bill_items (bill_id, item_description, quantity, unit_price) 
             VALUES (?, ?, ?, ?)`,
            [billResult.insertId, 
             `Room charges - Room ${assignment.room_number} (${daysStayed} days)`, 
             daysStayed, 
             assignment.room_charge_per_day]
        );
        
        await connection.commit();
        
        console.log('Discharge completed successfully:', {
            assignmentId: id,
            billId: billResult.insertId,
            daysStayed,
            totalCharges
        });
        
        res.json({ 
            message: 'Patient discharged successfully',
            daysStayed,
            totalCharges,
            billId: billResult.insertId,
            roomNumber: assignment.room_number,
            patientName: `${assignment.first_name} ${assignment.last_name}`
        });
    } catch (error) {
        console.error('Discharge patient error:', {
            error: error.message,
            stack: error.stack,
            sql: error.sql,
            sqlMessage: error.sqlMessage
        });
        
        if (connection) {
            await connection.rollback();
        }
        
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Appointment routes
app.get('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const { patient_id, doctor_id, date, status } = req.query;
        
        let query = `
            SELECT a.*, 
                   DATE_FORMAT(a.appointment_date, '%Y-%m-%d') as appointment_date,
                   TIME_FORMAT(a.appointment_time, '%H:%i') as appointment_time,
                   p.first_name as patient_first_name, p.last_name as patient_last_name,
                   d.first_name as doctor_first_name, d.last_name as doctor_last_name,
                   d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE 1=1
        `;
        let params = [];
        
        if (patient_id) {
            query += ' AND a.patient_id = ?';
            params.push(patient_id);
        }
        
        if (doctor_id) {
            query += ' AND a.doctor_id = ?';
            params.push(doctor_id);
        }
        
        if (date) {
            query += ' AND a.appointment_date = ?';
            params.push(date);
        }
        
        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY a.appointment_date, a.appointment_time';
        
        const [rows] = await pool.execute(query, params);
        
        // Log the first row for debugging
        if (rows.length > 0) {
            console.log('Sample appointment data:', {
                id: rows[0].appointment_id,
                date: rows[0].appointment_date,
                time: rows[0].appointment_time
            });
        }
        
        res.json(rows);
    } catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add endpoint to get a single appointment by ID
app.get('/api/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Getting appointment details for ID:', id);

        const [rows] = await pool.execute(`
            SELECT a.*, 
                   p.first_name as patient_first_name, p.last_name as patient_last_name,
                   d.first_name as doctor_first_name, d.last_name as doctor_last_name,
                   d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.patient_id
            JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE a.appointment_id = ?
        `, [id]);

        if (rows.length === 0) {
            console.log('Appointment not found:', id);
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Format date and time for client
        const appointment = rows[0];
        if (appointment.appointment_date) {
            appointment.appointment_date = appointment.appointment_date.toISOString().split('T')[0];
        }
        if (appointment.appointment_time) {
            appointment.appointment_time = appointment.appointment_time.slice(0, 5); // HH:mm format
        }

        console.log('Found appointment:', appointment);
        res.json(appointment);
    } catch (error) {
        console.error('Get appointment error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

app.post('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const {
            patient_id, doctor_id, appointment_date, appointment_time,
            reason_for_visit, notes, status = 'Scheduled'
        } = req.body;
        
        // Validate required fields
        if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Validate date and time format
        const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
        if (isNaN(appointmentDateTime)) {
            return res.status(400).json({ error: 'Invalid date or time format' });
        }
        
        // Format date in YYYY-MM-DD format
        const formattedDate = appointmentDateTime.toISOString().split('T')[0];
        // Format time in HH:mm format
        const formattedTime = appointmentDateTime.toTimeString().slice(0, 5);
        
        console.log('Creating appointment:', {
            patient_id, doctor_id,
            date: formattedDate,
            time: formattedTime,
            reason_for_visit, status
        });
        
        // Create the appointment with formatted date and time
        const [result] = await pool.execute(
            `INSERT INTO appointments (
                patient_id, doctor_id, appointment_date, appointment_time, 
                reason_for_visit, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [patient_id, doctor_id, formattedDate, formattedTime, 
             reason_for_visit, notes, status]
        );
        
        console.log('Appointment created:', result.insertId);
        
        res.status(201).json({
            message: 'Appointment created successfully',
            appointmentId: result.insertId
        });
    } catch (error) {
        console.error('Create appointment error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Add appointment status update endpoint
app.put('/api/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            patient_id,
            doctor_id,
            appointment_date,
            appointment_time,
            reason_for_visit,
            notes,
            status
        } = req.body;

        // Validate required fields
        if (!patient_id || !doctor_id || !appointment_date || !appointment_time || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate status
        const validStatuses = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') 
            });
        }

        // Validate date and time
        const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
        if (isNaN(appointmentDateTime)) {
            return res.status(400).json({ error: 'Invalid date or time format' });
        }

        console.log('Updating appointment:', { 
            id, 
            patient_id, 
            doctor_id, 
            appointment_date, 
            appointment_time, 
            status 
        });

        // Get current appointment to verify it exists
        const [existingAppointment] = await pool.execute(
            'SELECT * FROM appointments WHERE appointment_id = ?',
            [id]
        );

        if (existingAppointment.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Format date and time
        const formattedDate = appointmentDateTime.toISOString().split('T')[0];
        const formattedTime = appointmentDateTime.toTimeString().slice(0, 5);
        
        // Update all appointment details
        const [result] = await pool.execute(
            `UPDATE appointments 
             SET patient_id = ?,
                 doctor_id = ?,
                 appointment_date = ?,
                 appointment_time = ?,
                 reason_for_visit = ?,
                 notes = ?,
                 status = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE appointment_id = ?`,
            [
                patient_id,
                doctor_id,
                formattedDate,
                formattedTime,
                reason_for_visit || null,
                notes || null,
                status,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Get updated appointment details
        const [updatedAppointment] = await pool.execute(
            `SELECT a.*, 
                    p.first_name as patient_first_name, p.last_name as patient_last_name,
                    d.first_name as doctor_first_name, d.last_name as doctor_last_name,
                    d.specialization
             FROM appointments a
             JOIN patients p ON a.patient_id = p.patient_id
             JOIN doctors d ON a.doctor_id = d.doctor_id
             WHERE a.appointment_id = ?`,
            [id]
        );

        console.log('Appointment updated successfully');

        res.json({
            message: 'Appointment updated successfully',
            appointment: updatedAppointment[0]
        });
    } catch (error) {
        console.error('Update appointment error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Doctor routes
app.get('/api/doctors', authenticateToken, async (req, res) => {
    try {
        const { specialization, search } = req.query;
        
        let query = `
            SELECT 
                d.*,
                COUNT(DISTINCT a.appointment_id) as total_appointments,
                COUNT(DISTINCT CASE WHEN a.status = 'Scheduled' AND a.appointment_date >= CURDATE() THEN a.appointment_id END) as upcoming_appointments
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
        `;
        
        let whereConditions = [];
        let params = [];
        
        if (specialization) {
            whereConditions.push('d.specialization = ?');
            params.push(specialization);
        }
        
        if (search) {
            whereConditions.push('(d.first_name LIKE ? OR d.last_name LIKE ? OR d.specialization LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        query += ' GROUP BY d.doctor_id';
        query += ' ORDER BY d.specialization, d.last_name, d.first_name';
        
        console.log('Executing doctor query:', query, params);
        
        const [rows] = await pool.execute(query, params);
        
        // Add availability status
        const doctors = rows.map(doctor => ({
            ...doctor,
            availability_status: doctor.upcoming_appointments >= 20 ? 'Fully Booked' : 'Available'
        }));
        
        res.json(doctors);
    } catch (error) {
        console.error('Get doctors error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// Billing routes
// Add endpoint to update bill payment
app.put('/api/bills/:id', authenticateToken, async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { paid_amount, payment_status } = req.body;

        // Input validation
        if (paid_amount === undefined || !payment_status) {
            return res.status(400).json({ error: 'Paid amount and payment status are required' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Get current bill details
        const [bills] = await connection.execute(
            'SELECT * FROM bills WHERE bill_id = ? FOR UPDATE',
            [id]
        );

        if (bills.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Bill not found' });
        }

        const bill = bills[0];
        const newBalance = bill.total_amount - paid_amount;

        // Validate payment amount and status
        if (paid_amount === undefined || payment_status === undefined) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Both paid amount and payment status are required' 
            });
        }

        if (paid_amount < 0 || paid_amount > bill.total_amount) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Invalid payment amount. Amount must be between 0 and total bill amount.' 
            });
        }

        // Validate payment status
        const validStatuses = ['Unpaid', 'Partially Paid', 'Paid'];
        if (!validStatuses.includes(payment_status)) {
            await connection.rollback();
            return res.status(400).json({ 
                error: 'Invalid payment status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        // Update bill - don't update balance_amount as it's a generated column
        const [updateResult] = await connection.execute(
            `UPDATE bills 
             SET paid_amount = ?,
                 payment_status = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE bill_id = ?`,
            [paid_amount, payment_status, id]
        );

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Bill not found or no changes made' });
        }

        // Get updated bill details
        const [updatedBills] = await connection.execute(
            `SELECT b.*, 
                    p.first_name as patient_first_name, 
                    p.last_name as patient_last_name,
                    DATE_FORMAT(b.bill_date, '%Y-%m-%d') as bill_date,
                    DATE_FORMAT(b.due_date, '%Y-%m-%d') as due_date
             FROM bills b
             JOIN patients p ON b.patient_id = p.patient_id
             WHERE b.bill_id = ?`,
            [id]
        );

        await connection.commit();

        console.log('Bill updated successfully:', updatedBills[0]);

        res.json({
            message: 'Bill updated successfully',
            bill: updatedBills[0]
        });
    } catch (error) {
        console.error('Update bill error:', error);
        if (connection) await connection.rollback();
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Get single bill by ID
app.get('/api/bills/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Getting bill details for ID:', id);

        const [rows] = await pool.execute(`
            SELECT b.*, 
                   p.first_name as patient_first_name, 
                   p.last_name as patient_last_name,
                   DATE_FORMAT(b.bill_date, '%Y-%m-%d') as bill_date,
                   DATE_FORMAT(b.due_date, '%Y-%m-%d') as due_date
            FROM bills b
            JOIN patients p ON b.patient_id = p.patient_id
            WHERE b.bill_id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Bill not found' });
        }

        console.log('Found bill:', rows[0]);
        res.json(rows[0]);
    } catch (error) {
        console.error('Get bill error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

app.get('/api/bills', authenticateToken, async (req, res) => {
    try {
        const { patient_id, status, date_from, date_to } = req.query;
        
        let query = `
            SELECT b.*, p.first_name as patient_first_name, p.last_name as patient_last_name
            FROM bills b
            JOIN patients p ON b.patient_id = p.patient_id
            WHERE 1=1
        `;
        let params = [];
        
        if (patient_id) {
            query += ' AND b.patient_id = ?';
            params.push(patient_id);
        }
        
        if (status) {
            query += ' AND b.payment_status = ?';
            params.push(status);
        }
        
        if (date_from) {
            query += ' AND b.bill_date >= ?';
            params.push(date_from);
        }
        
        if (date_to) {
            query += ' AND b.bill_date <= ?';
            params.push(date_to);
        }
        
        query += ' ORDER BY b.bill_date DESC';
        
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Get bills error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Advanced SQL queries routes
app.get('/api/reports/patient-summary', authenticateToken, async (req, res) => {
    try {
        // Complex query with joins and aggregations
        const [rows] = await pool.execute(`
            SELECT 
                p.patient_id,
                CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                p.phone,
                p.email,
                COUNT(DISTINCT a.appointment_id) as total_appointments,
                COUNT(DISTINCT ra.assignment_id) as total_room_assignments,
                COALESCE(SUM(b.total_amount), 0) as total_bills,
                COALESCE(SUM(b.paid_amount), 0) as total_paid,
                COALESCE(SUM(b.balance_amount), 0) as total_balance,
                MAX(a.appointment_date) as last_appointment
            FROM patients p
            LEFT JOIN appointments a ON p.patient_id = a.patient_id
            LEFT JOIN room_assignments ra ON p.patient_id = ra.patient_id
            LEFT JOIN bills b ON p.patient_id = b.patient_id
            GROUP BY p.patient_id, p.first_name, p.last_name, p.phone, p.email
            ORDER BY total_bills DESC
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Patient summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/reports/room-occupancy', authenticateToken, async (req, res) => {
    try {
        // Room occupancy with nested subquery
        const [rows] = await pool.execute(`
            SELECT 
                r.room_id,
                r.room_number,
                r.room_type,
                r.floor_number,
                r.bed_capacity,
                r.current_occupancy,
                (r.bed_capacity - r.current_occupancy) as available_beds,
                r.is_available,
                CASE 
                    WHEN r.current_occupancy = 0 THEN 'Empty'
                    WHEN r.current_occupancy < r.bed_capacity THEN 'Partially Occupied'
                    ELSE 'Fully Occupied'
                END as occupancy_status,
                (SELECT COUNT(*) FROM room_assignments ra 
                 WHERE ra.room_id = r.room_id AND ra.is_active = 1) as active_assignments
            FROM rooms r
            ORDER BY r.floor_number, r.room_number
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Room occupancy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/reports/doctor-workload', authenticateToken, async (req, res) => {
    try {
        // Doctor workload with multiple joins and aggregations
        const [rows] = await pool.execute(`
            SELECT 
                d.doctor_id,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization,
                COUNT(DISTINCT a.appointment_id) as total_appointments,
                COUNT(DISTINCT CASE WHEN a.status = 'Completed' THEN a.appointment_id END) as completed_appointments,
                COUNT(DISTINCT CASE WHEN a.status = 'Scheduled' THEN a.appointment_id END) as scheduled_appointments,
                COUNT(DISTINCT mr.record_id) as medical_records_created,
                COALESCE(AVG(DATEDIFF(CURDATE(), a.appointment_date)), 0) as avg_days_since_appointment
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            LEFT JOIN medical_records mr ON d.doctor_id = mr.doctor_id
            GROUP BY d.doctor_id, d.first_name, d.last_name, d.specialization
            ORDER BY total_appointments DESC
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Doctor workload error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/reports/revenue-analysis', authenticateToken, async (req, res) => {
    try {
        // Revenue analysis with date grouping and aggregations
        const [rows] = await pool.execute(`
            SELECT 
                DATE_FORMAT(b.bill_date, '%Y-%m') as month,
                COUNT(*) as total_bills,
                SUM(b.total_amount) as total_revenue,
                SUM(b.paid_amount) as paid_revenue,
                SUM(b.balance_amount) as outstanding_revenue,
                AVG(b.total_amount) as avg_bill_amount,
                COUNT(CASE WHEN b.payment_status = 'Paid' THEN 1 END) as paid_bills,
                COUNT(CASE WHEN b.payment_status = 'Unpaid' THEN 1 END) as unpaid_bills,
                COUNT(CASE WHEN b.payment_status = 'Partially Paid' THEN 1 END) as partially_paid_bills
            FROM bills b
            WHERE b.bill_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(b.bill_date, '%Y-%m')
            ORDER BY month DESC
        `);
        
        res.json(rows);
    } catch (error) {
        console.error('Revenue analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- New lightweight endpoints for newly added tables ---

// Departments
app.get('/api/departments', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM departments ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/departments', authenticateToken, async (req, res) => {
    try {
        const { name, description, head_staff_id } = req.body;
        if (!name) return res.status(400).json({ error: 'Department name is required' });

        const [result] = await pool.execute(
            'INSERT INTO departments (name, description, head_staff_id) VALUES (?, ?, ?)',
            [name, description || null, head_staff_id || null]
        );

        res.status(201).json({ message: 'Department created', departmentId: result.insertId });
    } catch (error) {
        console.error('Create department error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Staff
app.get('/api/staff', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM staff ORDER BY last_name, first_name');
        res.json(rows);
    } catch (error) {
        console.error('Get staff error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/staff', authenticateToken, async (req, res) => {
    try {
        const { user_id, first_name, last_name, role, department_id, phone, email, hire_date } = req.body;
        if (!first_name || !last_name || !role) return res.status(400).json({ error: 'Missing required staff fields' });

        const [result] = await pool.execute(
            `INSERT INTO staff (user_id, first_name, last_name, role, department_id, phone, email, hire_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id || null, first_name, last_name, role, department_id || null, phone || null, email || null, hire_date || null]
        );

        res.status(201).json({ message: 'Staff created', staffId: result.insertId });
    } catch (error) {
        console.error('Create staff error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admissions
app.get('/api/admissions', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name,
                   s.first_name as staff_first_name, s.last_name as staff_last_name
            FROM admissions a
            JOIN patients p ON a.patient_id = p.patient_id
            LEFT JOIN staff s ON a.admitted_by_staff_id = s.staff_id
            ORDER BY a.admission_date DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Get admissions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/admissions', authenticateToken, async (req, res) => {
    try {
        const { patient_id, admitted_by_staff_id, admission_date, admission_reason } = req.body;
        if (!patient_id || !admission_date) return res.status(400).json({ error: 'patient_id and admission_date required' });

        const [result] = await pool.execute(
            'INSERT INTO admissions (patient_id, admitted_by_staff_id, admission_date, admission_reason) VALUES (?, ?, ?, ?)',
            [patient_id, admitted_by_staff_id || null, admission_date, admission_reason || null]
        );

        res.status(201).json({ message: 'Admission created', admissionId: result.insertId });
    } catch (error) {
        console.error('Create admission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Emergency contacts
app.get('/api/emergency-contacts', authenticateToken, async (req, res) => {
    try {
        const { patient_id } = req.query;
        let query = 'SELECT * FROM emergency_contacts';
        const params = [];
        if (patient_id) {
            query += ' WHERE patient_id = ?';
            params.push(patient_id);
        }
        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Get emergency contacts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/emergency-contacts', authenticateToken, async (req, res) => {
    try {
        const { patient_id, name, relationship, phone, email } = req.body;
        if (!patient_id || !name) return res.status(400).json({ error: 'patient_id and name required' });

        const [result] = await pool.execute(
            'INSERT INTO emergency_contacts (patient_id, name, relationship, phone, email) VALUES (?, ?, ?, ?, ?)',
            [patient_id, name, relationship || null, phone || null, email || null]
        );

        res.status(201).json({ message: 'Contact added', contactId: result.insertId });
    } catch (error) {
        console.error('Create emergency contact error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Lab tests
app.get('/api/lab-tests', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM lab_tests ORDER BY ordered_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Get lab tests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/lab-tests', authenticateToken, async (req, res) => {
    try {
        const { patient_id, ordered_by_doctor_id, appointment_id, test_type, sample_collected_at } = req.body;
        if (!patient_id || !test_type) return res.status(400).json({ error: 'patient_id and test_type required' });

        const [result] = await pool.execute(
            `INSERT INTO lab_tests (patient_id, ordered_by_doctor_id, appointment_id, test_type, sample_collected_at) 
             VALUES (?, ?, ?, ?, ?)`,
            [patient_id, ordered_by_doctor_id || null, appointment_id || null, test_type, sample_collected_at || null]
        );

        res.status(201).json({ message: 'Lab test ordered', testId: result.insertId });
    } catch (error) {
        console.error('Create lab test error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Medications
app.get('/api/medications', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM medications ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Get medications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/medications', authenticateToken, async (req, res) => {
    try {
        const { name, description, unit_price } = req.body;
        if (!name) return res.status(400).json({ error: 'Medication name required' });

        const [result] = await pool.execute(
            'INSERT INTO medications (name, description, unit_price) VALUES (?, ?, ?)',
            [name, description || null, unit_price || 0.00]
        );

        res.status(201).json({ message: 'Medication added', medicationId: result.insertId });
    } catch (error) {
        console.error('Create medication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Prescriptions (header)
app.get('/api/prescriptions', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM prescriptions ORDER BY prescribed_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Get prescriptions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/prescriptions', authenticateToken, async (req, res) => {
    try {
        const { patient_id, doctor_id, appointment_id, notes } = req.body;
        if (!patient_id || !doctor_id) return res.status(400).json({ error: 'patient_id and doctor_id required' });

        const [result] = await pool.execute(
            'INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, notes) VALUES (?, ?, ?, ?)',
            [patient_id, doctor_id, appointment_id || null, notes || null]
        );

        res.status(201).json({ message: 'Prescription created', prescriptionId: result.insertId });
    } catch (error) {
        console.error('Create prescription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Payments
app.post('/api/payments', authenticateToken, async (req, res) => {
    try {
        const { bill_id, amount, method, reference } = req.body;
        if (!bill_id || !amount) return res.status(400).json({ error: 'bill_id and amount required' });

        const [result] = await pool.execute(
            'INSERT INTO payments (bill_id, amount, method, reference) VALUES (?, ?, ?, ?)',
            [bill_id, amount, method || 'Cash', reference || null]
        );

        res.status(201).json({ message: 'Payment recorded', paymentId: result.insertId });
    } catch (error) {
        console.error('Create payment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User roles
app.get('/api/user-roles', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM user_roles ORDER BY role_name');
        res.json(rows);
    } catch (error) {
        console.error('Get user roles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Hospital Management System running on port ${PORT}`);
    console.log(`Database: ${dbConfig.database}@${dbConfig.host}`);
});

module.exports = app;

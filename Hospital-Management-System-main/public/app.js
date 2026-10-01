// Hospital Management System - Frontend JavaScript
class HospitalManagementSystem {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.token = localStorage.getItem('token');
        this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        this.currentPage = 1;
        this.pageSize = 10;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);
        
        if (this.token) {
            this.showMainApp();
            this.loadDashboard();
        } else {
            this.showLoginScreen();
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        
        // Navigation
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.dataset.section);
            });
        });

        // Patient form
        document.getElementById('savePatientBtn').addEventListener('click', () => this.savePatient());
        
        // Appointment form
        document.getElementById('saveAppointmentBtn').addEventListener('click', () => this.saveAppointment());
        
        // Room form
        document.getElementById('saveRoomBtn').addEventListener('click', () => this.saveRoom());
        
        // Room assignment form
        document.getElementById('saveAssignPatientBtn').addEventListener('click', () => this.saveRoomAssignment());
        
        // Discharge form
        document.getElementById('saveDischargeBtn').addEventListener('click', () => this.saveDischarge());

        // Search and filter inputs
        document.getElementById('patientSearch').addEventListener('input', 
            debounce(() => this.loadPatients(), 500));
        document.getElementById('patientPageSize').addEventListener('change', () => this.loadPatients());
        
        document.getElementById('appointmentDateFilter').addEventListener('change', () => this.loadAppointments());
        document.getElementById('appointmentStatusFilter').addEventListener('change', () => this.loadAppointments());
        
        document.getElementById('roomTypeFilter').addEventListener('change', () => this.loadRooms());
        document.getElementById('roomAvailabilityFilter').addEventListener('change', () => this.loadRooms());
        
        document.getElementById('billPatientSearch').addEventListener('input', 
            debounce(() => this.loadBills(), 500));
        document.getElementById('billStatusFilter').addEventListener('change', () => this.loadBills());
        document.getElementById('billDateFrom').addEventListener('change', () => this.loadBills());
        document.getElementById('billDateTo').addEventListener('change', () => this.loadBills());
    // New feature listeners for additional tables
    const saveDepartmentBtn = document.getElementById('saveDepartmentBtn');
    if (saveDepartmentBtn) saveDepartmentBtn.addEventListener('click', () => this.saveDepartment());

    const saveStaffBtn = document.getElementById('saveStaffBtn');
    if (saveStaffBtn) saveStaffBtn.addEventListener('click', () => this.saveStaff());

    const saveAdmissionBtn = document.getElementById('saveAdmissionBtn');
    if (saveAdmissionBtn) saveAdmissionBtn.addEventListener('click', () => this.saveAdmission());

    const saveLabTestBtn = document.getElementById('saveLabTestBtn');
    if (saveLabTestBtn) saveLabTestBtn.addEventListener('click', () => this.saveLabTest());

    const saveMedicationBtn = document.getElementById('saveMedicationBtn');
    if (saveMedicationBtn) saveMedicationBtn.addEventListener('click', () => this.saveMedication());

    const savePrescriptionBtn = document.getElementById('savePrescriptionBtn');
    if (savePrescriptionBtn) savePrescriptionBtn.addEventListener('click', () => this.savePrescription());

        // Populate selects when modals open
        const staffModalEl = document.getElementById('staffModal');
        if (staffModalEl) staffModalEl.addEventListener('shown.bs.modal', () => this.loadDepartments().then(() => this.populateDepartmentDropdownForStaff()));

        const admissionModalEl = document.getElementById('admissionModal');
        if (admissionModalEl) admissionModalEl.addEventListener('shown.bs.modal', async () => {
            await Promise.all([
                this.populatePatientSelect('admissionPatient'),
                this.loadStaff().then(() => this.populateStaffDropdown())
            ]);
        });

        const labTestModalEl = document.getElementById('labTestModal');
        if (labTestModalEl) labTestModalEl.addEventListener('shown.bs.modal', () => this.populatePatientSelect('labTestPatient'));

        const prescriptionModalEl = document.getElementById('prescriptionModal');
        if (prescriptionModalEl) prescriptionModalEl.addEventListener('shown.bs.modal', async () => {
            await Promise.all([
                this.populatePatientSelect('prescriptionPatient'),
                this.populateDoctorSelect('prescriptionDoctor')
            ]);
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        const loginBtn = document.getElementById('loginText');
        const loadingBtn = document.getElementById('loginLoading');
        const errorDiv = document.getElementById('loginError');
        
        loginBtn.classList.add('hidden');
        loadingBtn.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.currentUser));
                
                this.showMainApp();
                this.loadDashboard();
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.classList.remove('hidden');
        } finally {
            loginBtn.classList.remove('hidden');
            loadingBtn.classList.add('hidden');
        }
    }

    handleLogout() {
        this.token = null;
        this.currentUser = {};
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.showLoginScreen();
    }

    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show selected section
        document.getElementById(`${sectionName}Section`).classList.remove('hidden');
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Load section data
        switch(sectionName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'patients':
                this.loadPatients();
                break;
            case 'appointments':
                this.loadAppointments();
                this.loadPatientsForAppointment();
                this.loadDoctorsForAppointment();
                break;
            case 'rooms':
                this.loadRooms();
                break;
            case 'billing':
                this.loadBills();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'departments':
                this.loadDepartments();
                break;
            case 'staff':
                this.loadStaff();
                break;
            case 'admissions':
                this.loadAdmissions();
                break;
            case 'labTests':
                this.loadLabTests();
                break;
            case 'medications':
                this.loadMedications();
                break;
            case 'prescriptions':
                this.loadPrescriptions();
                break;
        }
    }

    updateDateTime() {
        const now = new Date();
        const dateTimeString = now.toLocaleString();
        const dateTimeElement = document.getElementById('currentDateTime');
        if (dateTimeElement) {
            dateTimeElement.textContent = dateTimeString;
        }
    }

    async makeRequest(endpoint, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };

        // Merge options and log request for debugging
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        };

        // Ensure endpoint starts with '/'
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

        // Debug: show request details (token will be printed here)
        try {
            console.debug('makeRequest:', `${this.apiBaseUrl}${path}`, finalOptions.method || 'GET', finalOptions.headers);
        } catch (e) {
            // ignore logging errors
        }

        const response = await fetch(`${this.apiBaseUrl}${path}`, finalOptions);

        // Treat both 401 and 403 as authorization failures so UI clears auth and re-prompts login
        if (response.status === 401 || response.status === 403) {
            console.warn('Authorization failed for', endpoint, 'status=', response.status);
            // Clear auth state and force login
            this.handleLogout();
            throw new Error('Unauthorized');
        }

        // Add error logging for other status codes
        if (!response.ok) {
            console.error('Request failed:', response.status, response.statusText);
            try {
                const errorData = await response.clone().json();
                console.error('Error data:', errorData);
            } catch (e) {
                console.error('Could not parse error response');
            }
        }

        return response;
    }

    async loadDashboard() {
        try {
            // Load recent appointments
            const appointmentsResponse = await this.makeRequest('/appointments?limit=5');
            const appointments = await appointmentsResponse.json();
            this.displayRecentAppointments(appointments);
            
            // Load dashboard statistics
            this.loadDashboardStats();
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    async loadDashboardStats() {
        try {
            // Load patients count
            const patientsResponse = await this.makeRequest('/patients?limit=1');
            const patientsData = await patientsResponse.json();
            document.getElementById('totalPatients').textContent = patientsData.pagination.totalItems;
            
            // Load today's appointments
            const today = new Date().toISOString().split('T')[0];
            const appointmentsResponse = await this.makeRequest(`/appointments?date=${today}`);
            const appointments = await appointmentsResponse.json();
            document.getElementById('todayAppointments').textContent = appointments.length;
            
            // Load available rooms
            const roomsResponse = await this.makeRequest('/rooms?available=true');
            const rooms = await roomsResponse.json();
            document.getElementById('availableRooms').textContent = rooms.length;
            
            // Load monthly revenue
            const revenueResponse = await this.makeRequest('/reports/revenue-analysis');
            const revenueData = await revenueResponse.json();
            const currentMonth = new Date().toISOString().substring(0, 7);
            const currentMonthData = revenueData.find(item => item.month === currentMonth);
            document.getElementById('monthlyRevenue').textContent = 
                currentMonthData ? `$${currentMonthData.total_revenue || 0}` : '$0';
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    displayRecentAppointments(appointments) {
        const tbody = document.getElementById('recentAppointments');
        tbody.innerHTML = '';
        
        if (appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No recent appointments</td></tr>';
            return;
        }
        
        appointments.forEach(appointment => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${appointment.patient_first_name} ${appointment.patient_last_name}</td>
                <td>Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}</td>
                <td>${appointment.appointment_date} ${appointment.appointment_time}</td>
                <td><span class="status-badge status-${appointment.status.toLowerCase()}">${appointment.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadPatients() {
        try {
            const search = document.getElementById('patientSearch').value;
            const pageSize = document.getElementById('patientPageSize').value;
            
            const response = await this.makeRequest(`/patients?search=${encodeURIComponent(search)}&page=${this.currentPage}&limit=${pageSize}`);
            const data = await response.json();
            
            console.log('Patients data received:', data);
            
            if (data && data.patients) {
                this.displayPatients(data.patients);
                if (data.pagination) {
                    this.displayPagination(data.pagination, 'patientPagination');
                }
            } else {
                console.error('Invalid data structure:', data);
                document.getElementById('patientsTable').innerHTML = 
                    '<tr><td colspan="7" class="text-center text-danger">Invalid response from server</td></tr>';
            }
        } catch (error) {
            console.error('Error loading patients:', error);
            document.getElementById('patientsTable').innerHTML = 
                '<tr><td colspan="7" class="text-center text-danger">Error loading patients: ' + error.message + '</td></tr>';
        }
    }

    displayPatients(patients) {
        const tbody = document.getElementById('patientsTable');
        tbody.innerHTML = '';
        
        if (patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No patients found</td></tr>';
            return;
        }
        
        patients.forEach(patient => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${patient.patient_id}</td>
                <td>${patient.first_name} ${patient.last_name}</td>
                <td>${patient.phone || '-'}</td>
                <td>${patient.email || '-'}</td>
                <td>${patient.gender}</td>
                <td>${patient.blood_type || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="app.editPatient(${patient.patient_id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="app.deletePatient(${patient.patient_id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadAppointments() {
        try {
            const date = document.getElementById('appointmentDateFilter').value;
            const status = document.getElementById('appointmentStatusFilter').value;
            
            let queryParams = [];
            if (date) queryParams.push(`date=${encodeURIComponent(date)}`);
            if (status) queryParams.push(`status=${encodeURIComponent(status)}`);
            
            const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
            console.log('Loading appointments:', queryString);
            
            const response = await this.makeRequest(`/appointments${queryString}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load appointments');
            }
            
            const appointments = await response.json();
            console.log('Loaded appointments:', appointments.length);
            
            this.displayAppointments(appointments);
        } catch (error) {
            console.error('Error loading appointments:', error);
            document.getElementById('appointmentsTable').innerHTML = 
                `<tr><td colspan="7" class="text-center text-danger">
                    Error loading appointments: ${error.message}
                </td></tr>`;
        }
    }

    displayAppointments(appointments) {
        const tbody = document.getElementById('appointmentsTable');
        tbody.innerHTML = '';
        
        if (!Array.isArray(appointments) || appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No appointments found</td></tr>';
            return;
        }
        
        appointments.forEach(appointment => {
            // Log raw date and time for debugging
            console.log('Raw appointment data:', {
                id: appointment.appointment_id,
                date: appointment.appointment_date,
                time: appointment.appointment_time
            });

            // Ensure proper date and time formatting
            let formattedDate = 'Invalid Date';
            let formattedTime = 'Invalid Time';

            try {
                // Handle MySQL date format (YYYY-MM-DD)
                if (appointment.appointment_date && appointment.appointment_time) {
                    const [year, month, day] = appointment.appointment_date.split('-').map(num => parseInt(num));
                    const [hours, minutes] = appointment.appointment_time.split(':').map(num => parseInt(num));
                    
                    const date = new Date(year, month - 1, day, hours, minutes);
                    
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString();
                        formattedTime = date.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                        });
                    }
                }
            } catch (error) {
                console.error('Date formatting error:', error);
            }
            
            // Get status badge class
            const statusClass = appointment.status ? appointment.status.toLowerCase() : 'unknown';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${appointment.patient_first_name} ${appointment.patient_last_name}</td>
                <td>Dr. ${appointment.doctor_first_name} ${appointment.doctor_last_name}</td>
                <td>${appointment.specialization || '-'}</td>
                <td>${formattedDate} ${formattedTime}</td>
                <td><span class="status-badge status-${statusClass}">${appointment.status}</span></td>
                <td>${appointment.reason_for_visit || '-'}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-info me-1" 
                                onclick="app.editAppointment(${appointment.appointment_id})"
                                title="Edit Appointment Details">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="app.updateAppointmentStatus(${appointment.appointment_id}, '${appointment.status}')"
                                title="Update Status">
                            <i class="fas fa-clock"></i>
                        </button>
                        ${appointment.status !== 'Cancelled' ? `
                            <button class="btn btn-sm btn-outline-danger ms-1" 
                                    onclick="app.updateAppointmentStatus(${appointment.appointment_id}, 'Cancelled')"
                                    title="Cancel Appointment">
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadRooms() {
        try {
            const type = document.getElementById('roomTypeFilter').value;
            const available = document.getElementById('roomAvailabilityFilter').value;
            
            let queryParams = [];
            if (type) queryParams.push(`type=${type}`);
            if (available) queryParams.push(`available=${available}`);
            
            const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
            const response = await this.makeRequest(`/rooms${queryString}`);
            const rooms = await response.json();
            
            // Load room assignments for each room and then display
            try {
                const assignmentsResponse = await this.makeRequest('/room-assignments?active=true');
                const assignments = await assignmentsResponse.json();
                
                // Add assignments to each room
                rooms.forEach(room => {
                    room.assignments = assignments.filter(a => a.room_id === room.room_id);
                });
            } catch (error) {
                console.error('Error loading room assignments:', error);
            }
            
            this.displayRooms(rooms);
        } catch (error) {
            console.error('Error loading rooms:', error);
            document.getElementById('roomsTable').innerHTML = 
                '<tr><td colspan="8" class="text-center text-danger">Error loading rooms</td></tr>';
        }
    }

    displayRooms(rooms) {
        const tbody = document.getElementById('roomsTable');
        tbody.innerHTML = '';
        
        if (rooms.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No rooms found</td></tr>';
            return;
        }
        
        // Get all active assignments to show patients in each room
        rooms.forEach(room => {
            const row = document.createElement('tr');
            const assignments = room.assignments || [];
            
            let patientsList = '';
            if (assignments.length > 0) {
                patientsList = assignments.map(a => 
                    `${a.patient_first_name} ${a.patient_last_name}`
                ).join(', ');
            }
            
            const occupancyDisplay = patientsList ? 
                `${room.current_occupancy}/${room.bed_capacity}<br><small class="text-muted">${patientsList}</small>` :
                `${room.current_occupancy}/${room.bed_capacity}`;
            
            // Clean room number for use in onclick
            const safeRoomNumber = String(room.room_number).replace(/'/g, "\\'");
            
            // Build buttons HTML
            let buttonsHTML = `<button class="btn btn-sm btn-outline-primary me-1" onclick="app.editRoom(${room.room_id})" title="Edit Room">
                    <i class="fas fa-edit"></i>
                </button>`;
            
            if (room.current_occupancy < room.bed_capacity) {
                buttonsHTML += `<button class="btn btn-sm btn-outline-success me-1" onclick="app.showAssignPatientModal(${room.room_id}, '${safeRoomNumber}')" title="Assign Patient">
                        <i class="fas fa-user-plus"></i>
                    </button>`;
            } else {
                buttonsHTML += `<button class="btn btn-sm btn-outline-secondary me-1" disabled title="Room is full">
                        <i class="fas fa-ban"></i>
                    </button>`;
            }
            
            if (room.current_occupancy > 0 && assignments.length > 0) {
                buttonsHTML += `<button class="btn btn-sm btn-outline-danger" onclick="app.showDischargeModal(${assignments[0].assignment_id}, '${safeRoomNumber}')" title="Discharge Patient">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>`;
            }
            
            row.innerHTML = `
                <td>${room.room_number}</td>
                <td>${room.room_type}</td>
                <td>${room.floor_number}</td>
                <td>${room.bed_capacity}</td>
                <td>${occupancyDisplay}</td>
                <td><span class="status-badge ${room.is_available ? 'status-confirmed' : 'status-cancelled'}">${room.is_available ? 'Available' : 'Occupied'}</span></td>
                <td>$${room.room_charge_per_day}</td>
                <td>${buttonsHTML}</td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadBills() {
        try {
            const patient = document.getElementById('billPatientSearch').value;
            const status = document.getElementById('billStatusFilter').value;
            const dateFrom = document.getElementById('billDateFrom').value;
            const dateTo = document.getElementById('billDateTo').value;
            
            let queryParams = [];
            if (patient) queryParams.push(`patient_id=${patient}`);
            if (status) queryParams.push(`status=${status}`);
            if (dateFrom) queryParams.push(`date_from=${dateFrom}`);
            if (dateTo) queryParams.push(`date_to=${dateTo}`);
            
            const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
            const response = await this.makeRequest(`/bills${queryString}`);
            const bills = await response.json();
            
            this.displayBills(bills);
        } catch (error) {
            console.error('Error loading bills:', error);
            document.getElementById('billsTable').innerHTML = 
                '<tr><td colspan="9" class="text-center text-danger">Error loading bills</td></tr>';
        }
    }

    displayBills(bills) {
        const tbody = document.getElementById('billsTable');
        tbody.innerHTML = '';
        
        if (bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No bills found</td></tr>';
            return;
        }
        
        bills.forEach(bill => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${bill.bill_id}</td>
                <td>${bill.patient_first_name} ${bill.patient_last_name}</td>
                <td>$${bill.total_amount}</td>
                <td>$${bill.paid_amount}</td>
                <td>$${bill.balance_amount}</td>
                <td><span class="status-badge status-${bill.payment_status.toLowerCase().replace(' ', '-')}">${bill.payment_status}</span></td>
                <td>${bill.bill_date}</td>
                <td>${bill.due_date || '-'}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="app.viewBillDetails(${bill.bill_id})"
                                title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="app.editBillPayment(${bill.bill_id})"
                                title="Update Payment">
                            <i class="fas fa-dollar-sign"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async editBillPayment(billId) {
        try {
            console.log('Editing bill payment for ID:', billId);
            
            // Get all bills and find the one we want
            const response = await this.makeRequest('/bills');
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load bills');
            }
            
            const bills = await response.json();
            const bill = bills.find(b => b.bill_id === billId);
            
            if (!bill) {
                throw new Error('Bill not found');
            }
            
            console.log('Found bill details:', bill);
            
            // Show payment update modal using SweetAlert2
            const result = await Swal.fire({
                title: 'Update Payment',
                html: `
                    <div class="mb-3">
                        <label class="form-label fw-bold">Total Amount: $${bill.total_amount}</label>
                    </div>
                    <div class="mb-3">
                        <label for="paidAmount" class="form-label">Paid Amount</label>
                        <div class="input-group">
                            <span class="input-group-text">$</span>
                            <input type="number" id="paidAmount" class="form-control" 
                                   value="${bill.paid_amount || 0}" 
                                   min="0" 
                                   max="${bill.total_amount}"
                                   step="0.01">
                        </div>
                        <div class="form-text">Current balance: $${bill.balance_amount || bill.total_amount}</div>
                    </div>
                    <div class="mb-3">
                        <label for="paymentStatus" class="form-label">Payment Status</label>
                        <select id="paymentStatus" class="form-select">
                            <option value="Unpaid" ${bill.payment_status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                            <option value="Partially Paid" ${bill.payment_status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
                            <option value="Paid" ${bill.payment_status === 'Paid' ? 'selected' : ''}>Paid</option>
                        </select>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Update Payment',
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#dc3545',
                showLoaderOnConfirm: true,
                preConfirm: async () => {
                    try {
                        const paidAmountInput = document.getElementById('paidAmount');
                        const paidAmount = parseFloat(paidAmountInput.value);
                        const paymentStatus = document.getElementById('paymentStatus').value;
                        
                        console.log('Processing payment update:', { 
                            billId, 
                            paidAmount, 
                            paymentStatus,
                            totalAmount: bill.total_amount 
                        });
                        
                        // Validate payment amount
                        if (isNaN(paidAmount) || paidAmount < 0) {
                            Swal.showValidationMessage('Please enter a valid payment amount');
                            return false;
                        }
                        
                        if (paidAmount > bill.total_amount) {
                            Swal.showValidationMessage('Paid amount cannot exceed total bill amount');
                            return false;
                        }
                        
                        // Calculate balance and determine status
                        const balance = bill.total_amount - paidAmount;
                        let effectiveStatus;
                        
                        if (paidAmount === 0) {
                            effectiveStatus = 'Unpaid';
                        } else if (Math.abs(balance) < 0.01) { // Account for floating point
                            effectiveStatus = 'Paid';
                        } else {
                            effectiveStatus = 'Partially Paid';
                        }
                        
                        console.log('Calculated payment details:', {
                            paidAmount,
                            balance,
                            effectiveStatus
                        });
                        
                        // Make the API request - balance_amount is generated by the database
                        const updateResponse = await fetch(`${this.apiBaseUrl}/bills/${billId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${this.token}`
                            },
                            body: JSON.stringify({
                                paid_amount: paidAmount,
                                payment_status: effectiveStatus
                            })
                        });
                        
                        console.log('API response status:', updateResponse.status);
                        
                        if (!updateResponse.ok) {
                            const errorText = await updateResponse.text();
                            console.error('Update failed:', errorText);
                            try {
                                const errorJson = JSON.parse(errorText);
                                throw new Error(errorJson.error || 'Failed to update payment');
                            } catch (e) {
                                throw new Error('Server error: ' + errorText);
                            }
                        }
                        
                        const result = await updateResponse.json();
                        console.log('Update successful:', result);
                        return result;
                    } catch (error) {
                        console.error('Payment update error:', error);
                        Swal.showValidationMessage(error.message);
                        return false;
                    }
                }
            });
            
            if (result.isConfirmed && result.value) {
                this.showAlert('Payment updated successfully', 'success');
                this.loadBills();
            }
        } catch (error) {
            console.error('Error updating payment:', error);
            this.showAlert(`Error updating payment: ${error.message}`, 'danger');
        }
    }

    async loadReports() {
        try {
            // Load patient summary
            const patientSummaryResponse = await this.makeRequest('/reports/patient-summary');
            const patientSummary = await patientSummaryResponse.json();
            this.displayPatientSummary(patientSummary);
            
            // Load room occupancy
            const roomOccupancyResponse = await this.makeRequest('/reports/room-occupancy');
            const roomOccupancy = await roomOccupancyResponse.json();
            this.displayRoomOccupancy(roomOccupancy);
            
            // Load doctor workload
            const doctorWorkloadResponse = await this.makeRequest('/reports/doctor-workload');
            const doctorWorkload = await doctorWorkloadResponse.json();
            this.displayDoctorWorkload(doctorWorkload);
            
            // Load revenue analysis
            const revenueAnalysisResponse = await this.makeRequest('/reports/revenue-analysis');
            const revenueAnalysis = await revenueAnalysisResponse.json();
            this.displayRevenueAnalysis(revenueAnalysis);
        } catch (error) {
            console.error('Error loading reports:', error);
        }
    }

    displayPatientSummary(data) {
        const tbody = document.getElementById('patientSummaryTable');
        tbody.innerHTML = '';
        
        data.forEach(patient => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${patient.patient_name}</td>
                <td>${patient.total_appointments}</td>
                <td>${patient.total_room_assignments}</td>
                <td>$${patient.total_bills}</td>
                <td>$${patient.total_balance}</td>
            `;
            tbody.appendChild(row);
        });
    }

    displayRoomOccupancy(data) {
        const tbody = document.getElementById('roomOccupancyTable');
        tbody.innerHTML = '';
        
        data.forEach(room => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${room.room_number}</td>
                <td>${room.room_type}</td>
                <td>${room.bed_capacity}</td>
                <td>${room.current_occupancy}</td>
                <td><span class="status-badge ${room.is_available ? 'status-confirmed' : 'status-cancelled'}">${room.occupancy_status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    displayDoctorWorkload(data) {
        const tbody = document.getElementById('doctorWorkloadTable');
        tbody.innerHTML = '';
        
        data.forEach(doctor => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${doctor.doctor_name}</td>
                <td>${doctor.specialization}</td>
                <td>${doctor.total_appointments}</td>
                <td>${doctor.completed_appointments}</td>
                <td>${doctor.medical_records_created}</td>
            `;
            tbody.appendChild(row);
        });
    }

    displayRevenueAnalysis(data) {
        const tbody = document.getElementById('revenueAnalysisTable');
        tbody.innerHTML = '';
        
        data.forEach(revenue => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${revenue.month}</td>
                <td>$${revenue.total_revenue}</td>
                <td>$${revenue.paid_revenue}</td>
                <td>$${revenue.outstanding_revenue}</td>
                <td>$${revenue.avg_bill_amount}</td>
            `;
            tbody.appendChild(row);
        });
    }

    async loadPatientsForAppointment() {
        try {
            const response = await this.makeRequest('/patients?limit=100');
            const data = await response.json();
            const select = document.getElementById('appointmentPatient');
            select.innerHTML = '<option value="">Select Patient</option>';
            
            data.patients.forEach(patient => {
                const option = document.createElement('option');
                option.value = patient.patient_id;
                option.textContent = `${patient.first_name} ${patient.last_name}`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading patients for appointment:', error);
        }
    }

    // Generic helper to populate a patient select by element id
    async populatePatientSelect(selectId, includePlaceholder = true) {
        try {
            const response = await this.makeRequest('/patients?limit=1000');
            const data = await response.json();
            const select = document.getElementById(selectId);
            if (!select) return;
            select.innerHTML = includePlaceholder ? '<option value="">Select Patient</option>' : '';
            if (data.patients && data.patients.length > 0) {
                data.patients.forEach(patient => {
                    const option = document.createElement('option');
                    option.value = patient.patient_id;
                    option.textContent = `${patient.first_name} ${patient.last_name}`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating patient select:', error);
        }
    }

    // Generic helper to populate a doctor select by element id
    async populateDoctorSelect(selectId, includePlaceholder = true) {
        try {
            const response = await this.makeRequest('/doctors');
            const doctors = await response.json();
            const select = document.getElementById(selectId);
            if (!select) return;
            select.innerHTML = includePlaceholder ? '<option value="">Select Doctor</option>' : '';
            if (Array.isArray(doctors)) {
                doctors.forEach(doctor => {
                    const option = document.createElement('option');
                    option.value = doctor.doctor_id;
                    option.textContent = `Dr. ${doctor.first_name} ${doctor.last_name}`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating doctor select:', error);
        }
    }

    // Populate department dropdown used when adding staff
    async populateDepartmentDropdownForStaff() {
        try {
            const response = await this.makeRequest('/departments');
            const departments = await response.json();
            const select = document.getElementById('staffDepartment');
            if (!select) return;
            select.innerHTML = '<option value="">Select Department</option>';
            if (Array.isArray(departments)) {
                departments.forEach(d => {
                    const option = document.createElement('option');
                    option.value = d.department_id;
                    option.textContent = d.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating departments for staff:', error);
        }
    }

    // Populate staff dropdown used in admissions
    async populateStaffDropdown() {
        try {
            const response = await this.makeRequest('/staff');
            const staff = await response.json();
            const select = document.getElementById('admissionStaff');
            if (!select) return;
            select.innerHTML = '<option value="">Select Staff (optional)</option>';
            if (Array.isArray(staff)) {
                staff.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.staff_id;
                    option.textContent = `${s.first_name} ${s.last_name} (${s.role})`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error populating staff dropdown:', error);
        }
    }

    // Departments
    async loadDepartments() {
        try {
            const response = await this.makeRequest('/departments');
            const departments = await response.json();
            const tbody = document.getElementById('departmentsTable');
            tbody.innerHTML = '';
            if (!Array.isArray(departments) || departments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No departments found</td></tr>';
                return;
            }
            departments.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${d.department_id}</td>
                    <td>${d.name}</td>
                    <td>${d.description || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading departments:', error);
        }
    }

    async saveDepartment() {
        try {
            const name = document.getElementById('departmentName').value.trim();
            const description = document.getElementById('departmentDescription').value.trim();
            if (!name) { this.showAlert('Department name is required', 'warning'); return; }

            const resp = await this.makeRequest('/departments', {
                method: 'POST',
                body: JSON.stringify({ name, description })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to create department');
            }

            bootstrap.Modal.getInstance(document.getElementById('departmentModal')).hide();
            document.getElementById('departmentForm').reset();
            this.loadDepartments();
            this.loadDepartments(); // refresh department lists used elsewhere
            this.showAlert('Department created', 'success');
        } catch (error) {
            console.error('Error saving department:', error);
            this.showAlert(error.message || 'Error creating department', 'danger');
        }
    }

    // Staff
    async loadStaff() {
        try {
            const response = await this.makeRequest('/staff');
            const staff = await response.json();
            const tbody = document.getElementById('staffTable');
            tbody.innerHTML = '';
            if (!Array.isArray(staff) || staff.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">No staff found</td></tr>';
                return;
            }
            staff.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${s.staff_id}</td>
                    <td>${s.first_name} ${s.last_name}</td>
                    <td>${s.role}</td>
                    <td>${s.department_id || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading staff:', error);
        }
    }

    async saveStaff() {
        try {
            const first_name = document.getElementById('staffFirstName').value.trim();
            const last_name = document.getElementById('staffLastName').value.trim();
            const role = document.getElementById('staffRole').value.trim();
            const department_id = document.getElementById('staffDepartment').value || null;
            const phone = document.getElementById('staffPhone').value.trim();
            const email = document.getElementById('staffEmail').value.trim();

            if (!first_name || !last_name || !role) { this.showAlert('Please fill required fields', 'warning'); return; }

            const resp = await this.makeRequest('/staff', {
                method: 'POST',
                body: JSON.stringify({ first_name, last_name, role, department_id, phone, email })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to create staff');
            }

            bootstrap.Modal.getInstance(document.getElementById('staffModal')).hide();
            document.getElementById('staffForm').reset();
            this.loadStaff();
            this.showAlert('Staff created', 'success');
        } catch (error) {
            console.error('Error saving staff:', error);
            this.showAlert(error.message || 'Error creating staff', 'danger');
        }
    }

    // Admissions
    async loadAdmissions() {
        try {
            const resp = await this.makeRequest('/admissions');
            const admissions = await resp.json();
            const tbody = document.getElementById('admissionsTable');
            tbody.innerHTML = '';
            if (!Array.isArray(admissions) || admissions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No admissions found</td></tr>';
                return;
            }
            admissions.forEach(a => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${a.admission_id}</td>
                    <td>${a.patient_first_name} ${a.patient_last_name}</td>
                    <td>${a.staff_first_name ? a.staff_first_name + ' ' + (a.staff_last_name||'') : '-'}</td>
                    <td>${a.admission_date}</td>
                    <td>${a.admission_reason || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading admissions:', error);
        }
    }

    async saveAdmission() {
        try {
            const patient_id = document.getElementById('admissionPatient').value;
            const admitted_by_staff_id = document.getElementById('admissionStaff').value || null;
            const admission_date = document.getElementById('admissionDateInput').value;
            const admission_reason = document.getElementById('admissionReason').value.trim();

            if (!patient_id || !admission_date) { this.showAlert('Please fill required fields', 'warning'); return; }

            const resp = await this.makeRequest('/admissions', {
                method: 'POST',
                body: JSON.stringify({ patient_id, admitted_by_staff_id, admission_date, admission_reason })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to create admission');
            }

            bootstrap.Modal.getInstance(document.getElementById('admissionModal')).hide();
            document.getElementById('admissionForm').reset();
            this.loadAdmissions();
            this.showAlert('Admission created', 'success');
        } catch (error) {
            console.error('Error creating admission:', error);
            this.showAlert(error.message || 'Error creating admission', 'danger');
        }
    }

    // Lab tests
    async loadLabTests() {
        try {
            const resp = await this.makeRequest('/lab-tests');
            const tests = await resp.json();
            const tbody = document.getElementById('labTestsTable');
            tbody.innerHTML = '';
            if (!Array.isArray(tests) || tests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No lab tests found</td></tr>';
                return;
            }
            tests.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${t.test_id}</td>
                    <td>${t.patient_id}</td>
                    <td>${t.test_type}</td>
                    <td>${t.status}</td>
                    <td>${t.ordered_at}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading lab tests:', error);
        }
    }

    async saveLabTest() {
        try {
            const patient_id = document.getElementById('labTestPatient').value;
            const test_type = document.getElementById('labTestType').value.trim();
            if (!patient_id || !test_type) { this.showAlert('Please fill required fields', 'warning'); return; }

            const resp = await this.makeRequest('/lab-tests', {
                method: 'POST',
                body: JSON.stringify({ patient_id, test_type })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to order lab test');
            }

            bootstrap.Modal.getInstance(document.getElementById('labTestModal')).hide();
            document.getElementById('labTestForm').reset();
            this.loadLabTests();
            this.showAlert('Lab test ordered', 'success');
        } catch (error) {
            console.error('Error ordering lab test:', error);
            this.showAlert(error.message || 'Error ordering lab test', 'danger');
        }
    }

    // Medications
    async loadMedications() {
        try {
            const resp = await this.makeRequest('/medications');
            const meds = await resp.json();
            const tbody = document.getElementById('medicationsTable');
            tbody.innerHTML = '';
            if (!Array.isArray(meds) || meds.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No medications found</td></tr>';
                return;
            }
            meds.forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${m.medication_id}</td>
                    <td>${m.name}</td>
                    <td>$${m.unit_price || 0}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading medications:', error);
        }
    }

    async saveMedication() {
        try {
            const name = document.getElementById('medicationName').value.trim();
            const unit_price = parseFloat(document.getElementById('medicationPrice').value) || 0.00;
            if (!name) { this.showAlert('Medication name required', 'warning'); return; }

            const resp = await this.makeRequest('/medications', {
                method: 'POST',
                body: JSON.stringify({ name, unit_price })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to add medication');
            }

            bootstrap.Modal.getInstance(document.getElementById('medicationModal')).hide();
            document.getElementById('medicationForm').reset();
            this.loadMedications();
            this.showAlert('Medication added', 'success');
        } catch (error) {
            console.error('Error adding medication:', error);
            this.showAlert(error.message || 'Error adding medication', 'danger');
        }
    }

    // Prescriptions
    async loadPrescriptions() {
        try {
            const resp = await this.makeRequest('/prescriptions');
            const items = await resp.json();
            const tbody = document.getElementById('prescriptionsTable');
            tbody.innerHTML = '';
            if (!Array.isArray(items) || items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center">No prescriptions found</td></tr>';
                return;
            }
            items.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${p.prescription_id}</td>
                    <td>${p.patient_id}</td>
                    <td>${p.doctor_id}</td>
                    <td>${p.prescribed_at}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error loading prescriptions:', error);
        }
    }

    async savePrescription() {
        try {
            const patient_id = document.getElementById('prescriptionPatient').value;
            const doctor_id = document.getElementById('prescriptionDoctor').value;
            const notes = document.getElementById('prescriptionNotes').value.trim();
            if (!patient_id || !doctor_id) { this.showAlert('Please select patient and doctor', 'warning'); return; }

            const resp = await this.makeRequest('/prescriptions', {
                method: 'POST',
                body: JSON.stringify({ patient_id, doctor_id, notes })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to create prescription');
            }

            bootstrap.Modal.getInstance(document.getElementById('prescriptionModal')).hide();
            document.getElementById('prescriptionForm').reset();
            this.loadPrescriptions();
            this.showAlert('Prescription created', 'success');
        } catch (error) {
            console.error('Error creating prescription:', error);
            this.showAlert(error.message || 'Error creating prescription', 'danger');
        }
    }

    async loadDoctorsForAppointment() {
        try {
            const response = await this.makeRequest('/doctors');
            const doctors = await response.json();
            const select = document.getElementById('appointmentDoctor');
            // Normalize doctors array
            const docs = Array.isArray(doctors) ? doctors : [];

            // Build a map of specialization -> doctors
            const doctorsBySpecialization = docs.reduce((groups, doctor) => {
                const spec = doctor.specialization || 'Other';
                if (!groups[spec]) groups[spec] = [];
                groups[spec].push(doctor);
                return groups;
            }, {});

            const sortedSpecializations = Object.keys(doctorsBySpecialization).sort();

            // Clear and add default option
            select.innerHTML = ''; // we'll add placeholder below

            // If browser supports optgroup, use grouped options; otherwise fall back to flat list
            try {
                // Add placeholder
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Select Doctor';
                placeholder.selected = true;
                placeholder.disabled = true;
                select.appendChild(placeholder);

                sortedSpecializations.forEach(spec => {
                    const group = document.createElement('optgroup');
                    group.label = spec;

                    const sortedDoctors = doctorsBySpecialization[spec].sort((a, b) =>
                        `${a.last_name || ''}, ${a.first_name || ''}`.localeCompare(`${b.last_name || ''}, ${b.first_name || ''}`)
                    );

                    sortedDoctors.forEach(doctor => {
                        const option = document.createElement('option');
                        option.value = doctor.doctor_id;
                        option.textContent = `Dr. ${doctor.first_name || ''} ${doctor.last_name || ''}`.trim();
                        group.appendChild(option);
                    });

                    select.appendChild(group);
                });
            } catch (e) {
                // Fallback: flat list
                select.innerHTML = '<option value="">Select Doctor</option>';
                docs.forEach(doctor => {
                    const option = document.createElement('option');
                    option.value = doctor.doctor_id;
                    option.textContent = `Dr. ${doctor.first_name || ''} ${doctor.last_name || ''}`.trim();
                    select.appendChild(option);
                });
            }

            // Create or update specialization filter (do not duplicate)
            let specSelect = document.getElementById('doctorSpecialization');
            if (!specSelect) {
                const filterContainer = document.createElement('div');
                filterContainer.className = 'mb-2';
                filterContainer.innerHTML = `
                    <label for="doctorSpecialization" class="form-label small mb-1">Filter by Specialization</label>
                    <select class="form-select form-select-sm" id="doctorSpecialization">
                        <option value="">All Specializations</option>
                        ${sortedSpecializations.map(spec => `<option value="${spec}">${spec}</option>`).join('')}
                    </select>
                `;

                // Insert filter above the select element within the same column container
                const doctorSelectContainer = select.closest('.mb-3') || select.parentElement;
                doctorSelectContainer.insertBefore(filterContainer, select);
                specSelect = document.getElementById('doctorSpecialization');
            } else {
                // update options if it already exists
                specSelect.innerHTML = '<option value="">All Specializations</option>' + sortedSpecializations.map(spec => `<option value="${spec}">${spec}</option>`).join('');
            }

            // Hook filter behavior
            specSelect.onchange = (e) => {
                const sel = e.target.value;
                const optgroups = select.getElementsByTagName('optgroup');
                if (optgroups.length === 0) return; // nothing to filter
                Array.from(optgroups).forEach(group => {
                    group.style.display = (!sel || group.label === sel) ? '' : 'none';
                });
            };

        } catch (error) {
            console.error('Error loading doctors for appointment:', error);
            this.showAlert('Error loading doctors. Please try again.', 'danger');
        }
    }

    async savePatient() {
        try {
            // Get and validate form elements
            const elements = {
                patientId: document.getElementById('patientId'),
                firstName: document.getElementById('firstName'),
                lastName: document.getElementById('lastName'),
                dateOfBirth: document.getElementById('dateOfBirth'),
                gender: document.getElementById('gender'),
                phone: document.getElementById('phone'),
                email: document.getElementById('email'),
                address: document.getElementById('address'),
                emergencyContactName: document.getElementById('emergencyContactName'),
                emergencyContactPhone: document.getElementById('emergencyContactPhone'),
                bloodType: document.getElementById('bloodType'),
                medicalHistory: document.getElementById('medicalHistory')
            };
            
            // Check that all required elements exist
            for (const [key, element] of Object.entries(elements)) {
                if (!element) {
                    throw new Error(`Required form element not found: ${key}`);
                }
            }
            
            const formData = {
                first_name: elements.firstName.value,
                last_name: elements.lastName.value,
                date_of_birth: elements.dateOfBirth.value,
                gender: elements.gender.value,
                phone: elements.phone.value,
                email: elements.email.value,
                address: elements.address.value,
                emergency_contact_name: elements.emergencyContactName.value,
                emergency_contact_phone: elements.emergencyContactPhone.value,
                blood_type: elements.bloodType.value,
                medical_history: elements.medicalHistory.value
            };
            
            const patientId = elements.patientId.value;
            const isUpdate = !!patientId;
            
            console.log(`${isUpdate ? 'Updating' : 'Creating'} patient:`, formData);
            
            const method = isUpdate ? 'PUT' : 'POST';
            const endpoint = isUpdate ? `/patients/${patientId}` : '/patients';
            
            const response = await this.makeRequest(endpoint, {
                method: method,
                body: JSON.stringify(formData)
            });
            
            console.log('Response status:', response.status);
            
            const data = await response.json();
            
            if (response.ok) {
                console.log(`Patient ${isUpdate ? 'updated' : 'created'} successfully:`, data);
                const modal = bootstrap.Modal.getInstance(document.getElementById('patientModal'));
                if (!modal) {
                    throw new Error('Could not find patient modal instance');
                }
                modal.hide();
                this.clearPatientForm();
                this.loadPatients();
                this.showAlert(`Patient ${isUpdate ? 'updated' : 'created'} successfully!`, 'success');
            } else {
                console.error(`Error ${isUpdate ? 'updating' : 'creating'} patient:`, data);
                this.showAlert(data.error || `Error ${isUpdate ? 'updating' : 'creating'} patient`, 'danger');
            }
        } catch (error) {
            console.error('Error in savePatient:', error);
            this.showAlert(`Error ${error.message}`, 'danger');
        }
    }


    
    async editAppointment(appointmentId) {
        try {
            console.log('Editing appointment:', appointmentId);
            
            // Get all required elements first
            const elements = {
                form: document.getElementById('appointmentForm'),
                patient: document.getElementById('appointmentPatient'),
                doctor: document.getElementById('appointmentDoctor'),
                date: document.getElementById('appointmentDate'),
                time: document.getElementById('appointmentTime'),
                reason: document.getElementById('reasonForVisit'),
                notes: document.getElementById('appointmentNotes'),
                saveBtn: document.getElementById('saveAppointmentBtn'),
                modalTitle: document.querySelector('#appointmentModal .modal-title')
            };
            
            // Verify all elements exist
            for (const [key, element] of Object.entries(elements)) {
                if (!element) {
                    throw new Error(`Required element not found: ${key}`);
                }
            }
            
            // Reset form and update UI elements
            elements.form.reset();
            elements.modalTitle.textContent = 'Edit Appointment';
            elements.saveBtn.textContent = 'Update Appointment';

            // Load patients and doctors first
            await Promise.all([
                this.loadPatientsForAppointment(),
                this.loadDoctorsForAppointment()
            ]);
            
            // Get the appointment details
            const response = await this.makeRequest(`/appointments/${appointmentId}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load appointment details');
            }
            
            const appointment = await response.json();
            console.log('Loaded appointment details:', appointment);
            
            // Set form values
            elements.patient.value = appointment.patient_id;
            elements.doctor.value = appointment.doctor_id;
            elements.date.value = appointment.appointment_date;
            elements.time.value = appointment.appointment_time;
            elements.reason.value = appointment.reason_for_visit || '';
            elements.notes.value = appointment.notes || '';
            
            // Store appointment ID and current status
            elements.form.dataset.appointmentId = appointmentId;
            elements.form.dataset.currentStatus = appointment.status;
            
            // Show modal
            const modalElement = document.getElementById('appointmentModal');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.show();
        } catch (error) {
            console.error('Error loading appointment details:', error);
            this.showAlert(`Error loading appointment details: ${error.message}`, 'danger');
        }
    }

    async saveAppointment() {
        try {
            // Get form elements
            const form = document.getElementById('appointmentForm');
            const formElements = {
                patient: document.getElementById('appointmentPatient'),
                doctor: document.getElementById('appointmentDoctor'),
                date: document.getElementById('appointmentDate'),
                time: document.getElementById('appointmentTime'),
                reason: document.getElementById('reasonForVisit'),
                notes: document.getElementById('appointmentNotes')
            };
            
            // Validate form elements exist
            for (const [key, element] of Object.entries(formElements)) {
                if (!element) {
                    throw new Error(`Required form element not found: ${key}`);
                }
            }
            
            // Get form data
            const formData = {
                patient_id: parseInt(formElements.patient.value),
                doctor_id: parseInt(formElements.doctor.value),
                appointment_date: formElements.date.value,
                appointment_time: formElements.time.value,
                reason_for_visit: formElements.reason.value.trim(),
                notes: formElements.notes.value.trim()
            };
            
            // Validate required fields are filled
            if (!formData.patient_id || !formData.doctor_id || !formData.appointment_date || !formData.appointment_time) {
                this.showAlert('Please fill in all required fields', 'warning');
                return;
            }
            
            // Validate date and time format
            const appointmentDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`);
            if (isNaN(appointmentDateTime)) {
                this.showAlert('Invalid date or time format', 'danger');
                return;
            }
            
            // Make sure the date is not in the past
            const now = new Date();
            if (appointmentDateTime < now) {
                this.showAlert('Cannot schedule appointments in the past', 'warning');
                return;
            }
            
            // Check if this is an update or new appointment
            const appointmentId = form.dataset.appointmentId;
            const isUpdate = !!appointmentId;
            
            // Add status for updates
            if (isUpdate) {
                formData.status = form.dataset.currentStatus || 'Scheduled';
            }
            
            console.log(`${isUpdate ? 'Updating' : 'Creating'} appointment:`, formData);
            
            const response = await this.makeRequest(
                isUpdate ? `/appointments/${appointmentId}` : '/appointments',
                {
                    method: isUpdate ? 'PUT' : 'POST',
                    body: JSON.stringify(formData)
                }
            );
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to ${isUpdate ? 'update' : 'create'} appointment`);
            }
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('appointmentModal'));
            modal.hide();
            
            // Reset form
            form.reset();
            delete form.dataset.appointmentId;
            delete form.dataset.currentStatus;
            
            // Reload appointments
            this.loadAppointments();
            
            this.showAlert(
                `Appointment ${isUpdate ? 'updated' : 'scheduled'} successfully!`,
                'success'
            );
        } catch (error) {
            console.error('Error saving appointment:', error);
            this.showAlert(`Error saving appointment: ${error.message}`, 'danger');
        }
    }

    async updateAppointmentStatus(appointmentId, currentStatus, directStatus = null) {
        try {
            let newStatus = directStatus;
            
            if (!directStatus) {
                // Show status update modal
                const result = await this.showStatusUpdateModal(currentStatus);
                if (!result) return; // User cancelled
                newStatus = result;
            }
            
            // Get current appointment details
            const response = await this.makeRequest(`/appointments/${appointmentId}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load appointment details');
            }
            
            const appointment = await response.json();
            
            // Update appointment with new status
            const updateResponse = await this.makeRequest(`/appointments/${appointmentId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...appointment,
                    status: newStatus
                })
            });
            
            if (!updateResponse.ok) {
                const error = await updateResponse.json();
                throw new Error(error.error || 'Failed to update appointment status');
            }
            
            // Reload appointments and show success message
            this.loadAppointments();
            this.showAlert('Appointment status updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating appointment status:', error);
            this.showAlert(`Error updating appointment status: ${error.message}`, 'danger');
        }
    }
    
    showStatusUpdateModal(currentStatus) {
        const statusOptions = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled'];
        const modalId = 'updateStatusModal';
        
        // Remove existing modal if any
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Update Appointment Status</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Select New Status</label>
                                <select class="form-select" id="newStatusSelect">
                                    ${statusOptions.map(status => 
                                        `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>
                                            ${status}
                                        </option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmStatusUpdate">Update Status</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Get modal element
        const modalElement = document.getElementById(modalId);
        
        // Return promise for modal result
        return new Promise((resolve) => {
            const modal = new bootstrap.Modal(modalElement);
            
            // Handle confirm button click
            document.getElementById('confirmStatusUpdate').onclick = () => {
                const selectedStatus = document.getElementById('newStatusSelect').value;
                modal.hide();
                resolve(selectedStatus);
            };
            
            // Handle modal hide - resolve with null if cancelled
            modalElement.addEventListener('hidden.bs.modal', () => {
                resolve(null);
                modalElement.remove();
            });
            
            modal.show();
        });
    }

    async saveRoom() {
        try {
            const roomId = document.getElementById('roomId')?.value;
            const formData = {
                room_number: document.getElementById('roomNumber').value,
                room_type: document.getElementById('roomType').value,
                floor_number: parseInt(document.getElementById('floorNumber').value),
                bed_capacity: parseInt(document.getElementById('bedCapacity').value),
                room_charge_per_day: parseFloat(document.getElementById('roomChargePerDay').value)
            };
            
            const method = roomId ? 'PUT' : 'POST';
            const endpoint = roomId ? `/rooms/${roomId}` : '/rooms';
            
            const response = await this.makeRequest(endpoint, {
                method: method,
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('roomModal')).hide();
                document.getElementById('roomForm').reset();
                this.loadRooms();
                this.showAlert(`Room ${roomId ? 'updated' : 'added'} successfully!`, 'success');
            } else {
                const error = await response.json();
                this.showAlert(error.error || `Error ${roomId ? 'updating' : 'adding'} room`, 'danger');
            }
        } catch (error) {
            console.error('Error saving room:', error);
            this.showAlert(`Error ${document.getElementById('roomId')?.value ? 'updating' : 'adding'} room`, 'danger');
        }
    }

    async editRoom(roomId) {
        try {
            console.log('Editing room:', roomId);
            const response = await this.makeRequest(`/rooms/${roomId}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load room details');
            }
            
            const room = await response.json();
            console.log('Loaded room details:', room);
            
            // Get all required elements
            const formElement = document.getElementById('roomForm');
            const roomIdElement = document.getElementById('roomId');
            const roomNumberElement = document.getElementById('roomNumber');
            const roomTypeElement = document.getElementById('roomType');
            const floorNumberElement = document.getElementById('floorNumber');
            const bedCapacityElement = document.getElementById('bedCapacity');
            const roomChargeElement = document.getElementById('roomChargePerDay');
            const modalTitleElement = document.getElementById('roomModalTitle');
            const saveButtonElement = document.getElementById('saveRoomBtn');
            
            // Check if all elements exist
            if (!formElement || !roomIdElement || !roomNumberElement || !roomTypeElement || 
                !floorNumberElement || !bedCapacityElement || !roomChargeElement || 
                !modalTitleElement || !saveButtonElement) {
                throw new Error('Required form elements not found');
            }
            
            // Reset form first
            formElement.reset();
            
            // Populate form
            roomIdElement.value = roomId;
            roomNumberElement.value = room.room_number;
            roomTypeElement.value = room.room_type;
            floorNumberElement.value = room.floor_number;
            bedCapacityElement.value = room.bed_capacity;
            roomChargeElement.value = room.room_charge_per_day;
            
            // Update modal title and button
            modalTitleElement.textContent = 'Edit Room';
            saveButtonElement.textContent = 'Update Room';
            
            // Show modal
            const modalElement = document.getElementById('roomModal');
            if (!modalElement) {
                throw new Error('Room modal element not found');
            }
            
            let modal = bootstrap.Modal.getInstance(modalElement);
            if (!modal) {
                modal = new bootstrap.Modal(modalElement);
            }
            modal.show();
        } catch (error) {
            console.error('Error loading room:', error);
            this.showAlert(`Error loading room details: ${error.message}`, 'danger');
        }
    }
    
    // Add a method to clear the room form when opening for a new room
    clearRoomForm() {
        try {
            // Get all required elements
            const formElement = document.getElementById('roomForm');
            const roomIdElement = document.getElementById('roomId');
            const modalTitleElement = document.getElementById('roomModalTitle');
            const saveButtonElement = document.getElementById('saveRoomBtn');
            
            // Check if elements exist
            if (!formElement || !roomIdElement || !modalTitleElement || !saveButtonElement) {
                throw new Error('Required form elements not found');
            }
            
            formElement.reset();
            roomIdElement.value = '';
            modalTitleElement.textContent = 'Add New Room';
            saveButtonElement.textContent = 'Save Room';
        } catch (error) {
            console.error('Error clearing room form:', error);
            this.showAlert(`Error resetting form: ${error.message}`, 'danger');
        }
    }

    async editPatient(patientId) {
        try {
            console.log('Editing patient:', patientId);
            
            // Get all form elements first
            const elements = {
                form: document.getElementById('patientForm'),
                patientId: document.getElementById('patientId'),
                firstName: document.getElementById('firstName'),
                lastName: document.getElementById('lastName'),
                dateOfBirth: document.getElementById('dateOfBirth'),
                gender: document.getElementById('gender'),
                phone: document.getElementById('phone'),
                email: document.getElementById('email'),
                address: document.getElementById('address'),
                emergencyContactName: document.getElementById('emergencyContactName'),
                emergencyContactPhone: document.getElementById('emergencyContactPhone'),
                bloodType: document.getElementById('bloodType'),
                medicalHistory: document.getElementById('medicalHistory'),
                modalTitle: document.getElementById('patientModalTitle')
            };
            
            // Verify all elements exist
            for (const [key, element] of Object.entries(elements)) {
                if (!element) {
                    throw new Error(`Required element not found: ${key}`);
                }
            }
            
            const response = await this.makeRequest(`/patients/${patientId}`);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to load patient data');
            }
            
            const patient = await response.json();
            console.log('Loaded patient data:', patient);
            
            // Reset form first
            elements.form.reset();
            
            // Populate form
            elements.patientId.value = patient.patient_id;
            elements.firstName.value = patient.first_name;
            elements.lastName.value = patient.last_name;
            elements.dateOfBirth.value = patient.date_of_birth;
            elements.gender.value = patient.gender;
            elements.phone.value = patient.phone || '';
            elements.email.value = patient.email || '';
            elements.address.value = patient.address || '';
            elements.emergencyContactName.value = patient.emergency_contact_name || '';
            elements.emergencyContactPhone.value = patient.emergency_contact_phone || '';
            elements.bloodType.value = patient.blood_type || '';
            elements.medicalHistory.value = patient.medical_history || '';
            
            // Update modal title
            elements.modalTitle.textContent = 'Edit Patient';
            
            // Show modal
            const modalElement = document.getElementById('patientModal');
            if (!modalElement) {
                throw new Error('Patient modal element not found');
            }
            
            let modal = bootstrap.Modal.getInstance(modalElement);
            if (!modal) {
                modal = new bootstrap.Modal(modalElement);
            }
            modal.show();
        } catch (error) {
            console.error('Error loading patient:', error);
            this.showAlert(`Error loading patient data: ${error.message}`, 'danger');
        }
    }
    
    // Add method to clear patient form
    clearPatientForm() {
        try {
            const formElement = document.getElementById('patientForm');
            const modalTitleElement = document.getElementById('patientModalTitle');
            
            if (!formElement || !modalTitleElement) {
                throw new Error('Required form elements not found');
            }
            
            formElement.reset();
            document.getElementById('patientId').value = '';
            modalTitleElement.textContent = 'Add New Patient';
        } catch (error) {
            console.error('Error clearing patient form:', error);
            this.showAlert(`Error resetting form: ${error.message}`, 'danger');
        }
    }

    async deletePatient(patientId) {
        if (confirm('Are you sure you want to delete this patient?')) {
            try {
                const response = await this.makeRequest(`/patients/${patientId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.loadPatients();
                    this.showAlert('Patient deleted successfully!', 'success');
                } else {
                    const error = await response.json();
                    this.showAlert(error.error || 'Error deleting patient', 'danger');
                }
            } catch (error) {
                console.error('Error deleting patient:', error);
                this.showAlert('Error deleting patient', 'danger');
            }
        }
    }

    displayPagination(pagination, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (pagination.totalPages <= 1) return;
        
        const { currentPage, totalPages } = pagination;
        
        // Previous button
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<a class="page-link" href="#" onclick="app.changePage(${currentPage - 1})">Previous</a>`;
        container.appendChild(prevLi);
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#" onclick="app.changePage(${i})">${i}</a>`;
            container.appendChild(li);
        }
        
        // Next button
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<a class="page-link" href="#" onclick="app.changePage(${currentPage + 1})">Next</a>`;
        container.appendChild(nextLi);
    }

    changePage(page) {
        this.currentPage = page;
        this.loadPatients();
    }

    showAlert(message, type) {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }

    async showAssignPatientModal(roomId, roomNumber) {
        try {
            // Store the room ID
            document.getElementById('assignRoomId').value = roomId;
            
            // Update modal title
            document.getElementById('assignPatientModalTitle').textContent = `Assign Patient to Room ${roomNumber}`;
            
            // Clear and show loading in patient select
            const select = document.getElementById('assignPatient');
            select.innerHTML = '<option value="">Loading patients...</option>';
            
            // Load patients for the dropdown
            try {
                const response = await this.makeRequest('/patients?limit=1000');
                const data = await response.json();
                
                select.innerHTML = '<option value="">Select Patient</option>';
                
                if (data.patients && data.patients.length > 0) {
                    data.patients.forEach(patient => {
                        const option = document.createElement('option');
                        option.value = patient.patient_id;
                        option.textContent = `${patient.first_name} ${patient.last_name} (ID: ${patient.patient_id})`;
                        select.appendChild(option);
                    });
                } else {
                    select.innerHTML = '<option value="">No patients available</option>';
                    this.showAlert('No patients found. Please add patients first.', 'warning');
                }
            } catch (loadError) {
                console.error('Error loading patients:', loadError);
                select.innerHTML = '<option value="">Error loading patients</option>';
                this.showAlert('Error loading patients: ' + loadError.message, 'danger');
            }
            
            // Set current date/time as default
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('admissionDate').value = now.toISOString().slice(0, 16);
            
            // Show modal - ensure we get or create the modal instance
            let modalElement = document.getElementById('assignPatientModal');
            let modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (!modalInstance) {
                modalInstance = new bootstrap.Modal(modalElement);
            }
            modalInstance.show();
        } catch (error) {
            console.error('Error showing assign patient modal:', error);
            this.showAlert('Error opening assignment window', 'danger');
        }
    }

    async saveRoomAssignment() {
        try {
            const roomId = document.getElementById('assignRoomId').value;
            const patientId = document.getElementById('assignPatient').value;
            const admissionDate = document.getElementById('admissionDate').value;
            
            if (!patientId || !admissionDate) {
                this.showAlert('Please fill all required fields', 'danger');
                return;
            }
            
            const formData = {
                room_id: parseInt(roomId),
                patient_id: parseInt(patientId),
                admission_date: admissionDate
            };
            
            console.log('Submitting assignment:', formData);
            
            const response = await this.makeRequest('/room-assignments', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            console.log('Assignment response:', response.status, data);
            
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('assignPatientModal')).hide();
                document.getElementById('assignPatientForm').reset();
                this.loadRooms();
                this.showAlert('Patient assigned to room successfully! A bill has been generated.', 'success');
            } else {
                const errorMessage = data.error || data.message || 'Error assigning patient to room';
                console.error('Assignment error:', data);
                this.showAlert(errorMessage, 'danger');
            }
        } catch (error) {
            console.error('Error saving room assignment:', error);
            const errorMsg = error.message || 'Error assigning patient to room';
            this.showAlert(errorMsg, 'danger');
        }
    }

    async showDischargeModal(assignmentId, roomNumber) {
        try {
            document.getElementById('dischargeAssignmentId').value = assignmentId;
            document.getElementById('dischargeModalTitle').textContent = `Discharge Patient from Room ${roomNumber}`;
            
            // Set current date/time as default
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('dischargeDate').value = now.toISOString().slice(0, 16);
            
            // Show modal
            let modalElement = document.getElementById('dischargeModal');
            let modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (!modalInstance) {
                modalInstance = new bootstrap.Modal(modalElement);
            }
            modalInstance.show();
        } catch (error) {
            console.error('Error showing discharge modal:', error);
            this.showAlert('Error opening discharge window', 'danger');
        }
    }

    async saveDischarge() {
        try {
            const assignmentId = document.getElementById('dischargeAssignmentId').value;
            const dischargeDate = document.getElementById('dischargeDate').value;
            
            if (!dischargeDate) {
                this.showAlert('Please select discharge date and time', 'danger');
                return;
            }
            
            const response = await this.makeRequest(`/room-assignments/${assignmentId}/discharge`, {
                method: 'PUT',
                body: JSON.stringify({ discharge_date: dischargeDate })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                bootstrap.Modal.getInstance(document.getElementById('dischargeModal')).hide();
                document.getElementById('dischargeForm').reset();
                this.loadRooms();
                this.showAlert(`Patient discharged successfully! Final bill generated for ${data.daysStayed} day(s) stay.`, 'success');
            } else {
                const errorMessage = data.error || data.message || 'Error discharging patient';
                console.error('Discharge error:', data);
                this.showAlert(errorMessage, 'danger');
            }
        } catch (error) {
            console.error('Error discharging patient:', error);
            this.showAlert('Error discharging patient', 'danger');
        }
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize the application
const app = new HospitalManagementSystem();

// Expose app to window for global access
window.app = app;

// Global wrapper used by quick-action buttons in the HTML (e.g. onclick="showSection('patients')")
function showSection(sectionName) {
    if (window.app && typeof window.app.showSection === 'function') {
        window.app.showSection(sectionName);
    }
}

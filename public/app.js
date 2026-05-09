const API_BASE = ''; // Use relative paths so it works automatically on localhost and Render

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // AUTHENTICATION LOGIC
    // ==========================================
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMsg');
            
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                
                if (res.ok) {
                    window.location.href = 'dashboard.html';
                } else {
                    errorMsg.textContent = data.error;
                    errorMsg.classList.remove('hidden');
                }
            } catch (err) {
                errorMsg.textContent = 'Server connection error';
                errorMsg.classList.remove('hidden');
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const errorMsg = document.getElementById('regErrorMsg');
            const successMsg = document.getElementById('regSuccessMsg');
            
            errorMsg.classList.add('hidden');
            successMsg.classList.add('hidden');

            try {
                const res = await fetch(`${API_BASE}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json();
                
                if (res.ok) {
                    successMsg.textContent = 'Registration successful! Redirecting to login...';
                    successMsg.classList.remove('hidden');
                    setTimeout(() => { window.location.href = 'index.html'; }, 2000);
                } else {
                    errorMsg.textContent = data.error;
                    errorMsg.classList.remove('hidden');
                }
            } catch (err) {
                errorMsg.textContent = 'Server connection error';
                errorMsg.classList.remove('hidden');
            }
        });
    }

    // ==========================================
    // DASHBOARD LOGIC
    // ==========================================
    
    // Check if we are on dashboard
    if (window.location.pathname.includes('dashboard.html')) {
        
        // 1. Check Authentication
        fetch(`${API_BASE}/api/check-auth`)
            .then(res => res.json())
            .then(data => {
                if (!data.authenticated) {
                    window.location.href = 'index.html';
                } else {
                    document.getElementById('userNameDisplay').textContent = `Welcome, ${data.userName}`;
                }
            });

        // 2. Logout Handler
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            await fetch(`${API_BASE}/logout`);
            window.location.href = 'index.html';
        });

        // 3. Initialize Gauges & Charts
        let tempGauge;
        if (typeof JustGage !== 'undefined') {
            tempGauge = new JustGage({
                id: "tempGauge",
                value: 0,
                min: 0,
                max: 100,
                title: "°C",
                label: "",
                pointer: true,
                pointerOptions: {
                    toplength: -15,
                    bottomlength: 10,
                    bottomwidth: 12,
                    color: '#8E8E93',
                    stroke: '#ffffff',
                    stroke_width: 3,
                    stroke_linecap: 'round'
                },
                gaugeWidthScale: 0.6,
                counter: true,
                relativeGaugeSize: true,
                levelColors: ["#3b82f6", "#22c55e", "#ef4444"] // Blue -> Green -> Red
            });
        }

        const ctx = document.getElementById('mainChart').getContext('2d');
        const mainChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Temperature (°C)', borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', data: [], tension: 0.4, fill: true },
                    { label: 'Humidity (%)', borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', data: [], tension: 0.4, fill: true },
                    { label: 'Soil Moisture (%)', borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', data: [], tension: 0.4, fill: true }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                },
                plugins: {
                    legend: { labels: { color: '#f3f4f6' } }
                }
            }
        });

        // 4. Fetch & Update Data Functions
        let lastObjectCount = -1;

        async function fetchLatestData() {
            try {
                const res = await fetch(`${API_BASE}/api/latest-data`);
                const data = await res.json();
                
                if (data && Object.keys(data).length > 0) {
                    // Update Temp Gauge
                    if (tempGauge) tempGauge.refresh(data.temperature);
                    
                    // Update Humidity Bar
                    document.getElementById('humValue').textContent = `${data.humidity}%`;
                    document.getElementById('humBar').style.width = `${data.humidity}%`;

                    // Update Soil Moisture
                    document.getElementById('soilValue').textContent = `${data.soilMoisture}%`;
                    const soilStatus = document.getElementById('soilStatus');
                    if (data.soilMoisture < 30) {
                        soilStatus.textContent = "DRY";
                        soilStatus.className = "inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-900 text-red-300";
                    } else if (data.soilMoisture > 70) {
                        soilStatus.textContent = "TOO WET";
                        soilStatus.className = "inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-900 text-blue-300";
                    } else {
                        soilStatus.textContent = "OPTIMAL";
                        soilStatus.className = "inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-900 text-green-300";
                    }

                    // Update IR Status & Buzzer Animation
                    const irIndicator = document.getElementById('irIndicator');
                    const irIcon = document.getElementById('irIcon');
                    const irText = document.getElementById('irText');
                    
                    // Assuming LOW (0) means object detected, HIGH (1) means clear
                    if (data.irStatus == 0) {
                        irIndicator.className = "w-16 h-16 rounded-full flex items-center justify-center text-2xl buzzer-active transition-all duration-300 mb-4";
                        irIcon.className = "fa-solid fa-person text-white";
                        irText.textContent = "OBJECT DETECTED";
                        irText.className = "font-bold text-lg text-red-400";
                    } else {
                        irIndicator.className = "w-16 h-16 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] flex items-center justify-center text-2xl transition-all duration-300 mb-4";
                        irIcon.className = "fa-solid fa-check text-white";
                        irText.textContent = "CLEAR";
                        irText.className = "font-bold text-lg text-green-400";
                    }

                    // Update Object Count
                    document.getElementById('objCountValue').textContent = data.objectCount;
                }
            } catch (err) {
                console.error("Error fetching latest data:", err);
            }
        }

        async function fetchHistory() {
            try {
                const res = await fetch(`${API_BASE}/api/history`);
                const history = await res.json();
                
                // Update Table
                const tbody = document.getElementById('historyTableBody');
                tbody.innerHTML = '';
                
                // Show latest first
                const reversedHistory = [...history].reverse();
                
                reversedHistory.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-gray-800 transition-colors";
                    
                    const irText = row.irStatus == 0 ? '<span class="text-red-400">Detected</span>' : '<span class="text-green-400">Clear</span>';

                    tr.innerHTML = `
                        <td class="px-4 py-3">${row.date}</td>
                        <td class="px-4 py-3">${row.time}</td>
                        <td class="px-4 py-3">${row.temperature}</td>
                        <td class="px-4 py-3">${row.humidity}</td>
                        <td class="px-4 py-3">${row.soilMoisture}</td>
                        <td class="px-4 py-3 font-semibold">${irText}</td>
                        <td class="px-4 py-3 font-mono text-indigo-300">${row.objectCount}</td>
                        <td class="px-4 py-3 text-right">
                            <button onclick="deleteRecord('${row.id}')" class="text-red-400 hover:text-red-300">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Update Chart (limit to last 20 points for readability)
                const chartData = history.slice(-20);
                mainChart.data.labels = chartData.map(d => d.time);
                mainChart.data.datasets[0].data = chartData.map(d => d.temperature);
                mainChart.data.datasets[1].data = chartData.map(d => d.humidity);
                mainChart.data.datasets[2].data = chartData.map(d => d.soilMoisture);
                mainChart.update();

            } catch (err) {
                console.error("Error fetching history:", err);
            }
        }

        // Global function for inline onclick
        window.deleteRecord = async function(id) {
            if(confirm("Delete this record?")) {
                await fetch(`${API_BASE}/api/history/${id}`, { method: 'DELETE' });
                fetchHistory();
            }
        };

        // 5. Setup Intervals
        setInterval(fetchLatestData, 2000);
        setInterval(fetchHistory, 5000); // Fetch history less frequently
        fetchLatestData();
        fetchHistory();

        document.getElementById('refreshTableBtn').addEventListener('click', fetchHistory);

        // 6. LCD Message Control
        document.getElementById('lcdForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = document.getElementById('lcdInput').value;
            try {
                const res = await fetch(`${API_BASE}/api/lcd-message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                if (res.ok) {
                    const fb = document.getElementById('lcdFeedback');
                    fb.classList.remove('hidden');
                    setTimeout(() => fb.classList.add('hidden'), 3000);
                }
            } catch (err) {
                console.error("LCD update error:", err);
            }
        });

        // 7. Blynk LED Control
        document.getElementById('ledOnBtn').addEventListener('click', () => {
            fetch(`${API_BASE}/api/led/on`, { method: 'POST' })
                .then(res => res.json())
                .then(data => console.log(data));
        });
        document.getElementById('ledOffBtn').addEventListener('click', () => {
            fetch(`${API_BASE}/api/led/off`, { method: 'POST' })
                .then(res => res.json())
                .then(data => console.log(data));
        });

        // 8. Reset Counter
        document.getElementById('resetCountBtn').addEventListener('click', () => {
            fetch(`${API_BASE}/api/reset-count`, { method: 'POST' })
                .then(res => res.json())
                .then(data => alert(data.message));
        });

    } // end dashboard logic

});

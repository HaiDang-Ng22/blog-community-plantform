const http = require('http');

const baseUrl = 'http://localhost:5142/api';
const adminEmail = 'hd813345@gmail.com';
const password = 'D@ng0799192226';

async function request(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTest() {
  try {
    console.log('--- Phase 1: Login ---');
    const loginRes = await request('auth/login', 'POST', { email: adminEmail, password: password });
    if (loginRes.status !== 200) throw new Error('Login failed: ' + JSON.stringify(loginRes.data));
    const token = loginRes.data.token;
    console.log('Login success.');

    console.log('\n--- Phase 2: Create Category ---');
    const createRes = await request('admin/categories', 'POST', { name: 'Test Category', icon: 'fa-test' }, token);
    console.log('Create Response:', createRes);
    if (createRes.status !== 200) throw new Error('Create failed');
    const catId = createRes.data.id;

    console.log('\n--- Phase 3: Get Categories ---');
    const getRes = await request(`admin/categories?t=${Date.now()}`, 'GET', null, token);
    console.log('Get count:', getRes.data.length);
    const found = getRes.data.find(c => c.id === catId);
    console.log('Found in list:', found ? 'Yes' : 'No');

    console.log('\n--- Phase 4: Delete Category ---');
    const delRes = await request(`admin/categories/${catId}`, 'DELETE', null, token);
    console.log('Delete Response:', delRes);

    console.log('\n--- Phase 5: Verify Deletion ---');
    const verifyRes = await request(`admin/categories?t=${Date.now()}`, 'GET', null, token);
    const stillExists = verifyRes.data.find(c => c.id === catId);
    console.log('Still exists:', stillExists ? 'Yes' : 'No');

    if (!stillExists) console.log('\nTEST PASSED: API is fully functional.');
    else console.log('\nTEST FAILED: Category still exists after deletion.');

  } catch (err) {
    console.error('TEST ERROR:', err.message);
  }
}

runTest();

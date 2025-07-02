// Debug script to test extension communication
// Run this in the browser console on any page after loading the extension

console.log('=== Extension Debug Test ===');

// Test 1: Check if extension is loaded
console.log('Extension ID:', chrome.runtime?.id);
console.log('Extension available:', !!chrome.runtime);

// Test 2: Simple ping to background script
function testBackgroundConnection() {
  console.log('Testing background script connection...');
  
  const message = {
    type: 'GET_AUTH_STATUS',
    action: 'GET_AUTH_STATUS'
  };
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Background connection test timeout'));
    }, 5000);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeout);
      
      if (chrome.runtime.lastError) {
        console.error('Background test failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        console.log('Background test successful:', response);
        resolve(response);
      }
    });
  });
}

// Test 3: Check service worker status
async function checkServiceWorkerStatus() {
  try {
    // This will only work in the extension context
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('Service Worker registrations:', registrations.length);
    
    registrations.forEach((registration, index) => {
      console.log(`SW ${index}:`, {
        scope: registration.scope,
        state: registration.active?.state,
        scriptURL: registration.active?.scriptURL
      });
    });
  } catch (error) {
    console.log('Service Worker check not available:', error.message);
  }
}

// Run tests
async function runDebugTests() {
  console.log('\n--- Running Extension Debug Tests ---');
  
  // Test background connection
  try {
    const authStatus = await testBackgroundConnection();
    console.log('✅ Background script responsive');
    console.log('Auth status:', authStatus);
  } catch (error) {
    console.error('❌ Background script not responding:', error.message);
  }
  
  // Test service worker
  await checkServiceWorkerStatus();
  
  console.log('\n--- Debug Tests Complete ---');
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  runDebugTests();
} else {
  console.error('Not running in Chrome extension context');
}
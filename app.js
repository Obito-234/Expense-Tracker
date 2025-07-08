// Initialize Firebase (Compat SDK)
const firebaseConfig = {
  apiKey: "AIzaSyBypIWILBbuDB8_RVo7bmePtlHVdiMI364",
  authDomain: "project-et-f3433.firebaseapp.com",
  projectId: "project-et-f3433",
  storageBucket: "project-et-f3433.appspot.com",
  messagingSenderId: "441509299409",
  appId: "1:441509299409:web:a96c853509165fb0c5f1f0",
  measurementId: "G-GPZYRY3D90"
};

firebase.initializeApp(firebaseConfig);
if ('measurementId' in firebaseConfig && typeof firebase.analytics === 'function') {
  firebase.analytics();
}

// Transaction storage key
const STORAGE_KEY = 'expense_tracker_transactions';

const db = firebase.firestore();

let currentUser = null;

function getTransactions() {
  if (currentUser) {
    // Firestore fetch will be async, handled elsewhere
    return [];
  }
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveTransactions(transactions) {
  if (currentUser) {
    // Firestore save will be async, handled elsewhere
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function showError(message) {
  alert(message); // You can replace this with a nicer UI if desired
}

async function loadTransactionsFromFirestore() {
  try {
    console.log("Loading transactions from Firestore for:", currentUser && currentUser.uid);
    const snapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').orderBy('timestamp', 'desc').get();
    const transactions = snapshot.docs.map(doc => doc.data());
    console.log("Loaded transactions:", transactions);
    renderTransactions(transactions);
  } catch (err) {
    console.error("Error loading transactions from Firestore:", err);
    showError("Failed to load transactions from the cloud. Please try again later.");
    renderTransactions(); // fallback to local
  }
}

async function saveTransactionToFirestore(tx) {
  try {
    console.log("Saving transaction to Firestore:", tx);
    await db.collection('users').doc(currentUser.uid).collection('transactions').add({
      ...tx,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Error saving transaction to Firestore:", err);
    showError("Failed to save transaction to the cloud. Please try again later.");
  }
}

function renderTransactions(transactions) {
  const list = document.getElementById('transaction-list');
  transactions = transactions || getTransactions();
  list.innerHTML = '';
  if (transactions.length === 0) {
    list.innerHTML = '<li style="color:#888;">No transactions yet.</li>';
    document.getElementById('total-display').innerHTML = '';
    return;
  }
  let total = 0;
  let totalGain = 0;
  let totalLoss = 0;
  // Reverse transactions so latest is at the bottom
  transactions = transactions.slice().reverse();
  transactions.forEach((tx, idx) => {
    const li = document.createElement('li');
    li.className = 'transaction-item';
    li.innerHTML = `
      <div class="transaction-details">
        <span><strong>${tx.description}</strong> <span class="tx-method">(${tx.paymentMethod})</span></span>
        <span>${tx.date}</span>
      </div>
      <span class="transaction-amount ${tx.type}">
        ${tx.type === 'gain' ? '+' : '-'}₹${parseFloat(tx.amount).toFixed(2)}
      </span>
      <button class="remove-tx-btn" data-idx="${idx}">&times;</button>
    `;
    list.appendChild(li);
    if (tx.type === 'gain') {
      totalGain += parseFloat(tx.amount);
      total += parseFloat(tx.amount);
    } else {
      totalLoss += parseFloat(tx.amount);
      total -= parseFloat(tx.amount);
    }
  });
  // Add event listeners for remove buttons
  document.querySelectorAll('.remove-tx-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
      const idx = parseInt(this.getAttribute('data-idx'));
      if (currentUser) {
        // Remove from Firestore by matching all fields (since no doc id is stored)
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('transactions').orderBy('timestamp', 'desc').get();
        const doc = snapshot.docs[snapshot.docs.length - 1 - idx];
        if (doc) await doc.ref.delete();
        await loadTransactionsFromFirestore();
      } else {
        const transactions = getTransactions();
        transactions.splice(transactions.length - 1 - idx, 1);
        saveTransactions(transactions);
        renderTransactions();
      }
    });
  });
  // Show total gain, total loss, and total at the bottom
  const totalDisplay = document.getElementById('total-display');
  let totalClass = '';
  if (total > 0) totalClass = 'gain';
  else if (total < 0) totalClass = 'loss';
  totalDisplay.innerHTML = `
    <div class="totals-row">
      <div class="totals-col"><strong>Total Gain:</strong> <span class="transaction-amount gain">₹${totalGain.toFixed(2)}</span></div>
      <div class="totals-col"><strong>Total Loss:</strong> <span class="transaction-amount loss">₹${totalLoss.toFixed(2)}</span></div>
    </div>
    <div class="totals-total">
      <strong>Total:</strong> <span class="transaction-amount ${totalClass}">₹${total.toFixed(2)}</span>
    </div>
  `;
  // Scroll to the bottom to show the latest transaction
  list.scrollTop = list.scrollHeight;
}

// Transaction form submit
const form = document.getElementById('transaction-form');
form.addEventListener('submit', async function(e) {
  e.preventDefault();
  const type = document.getElementById('type').value;
  const amount = document.getElementById('amount').value;
  const paymentMethod = document.getElementById('payment-method').value;
  const description = document.getElementById('description').value.trim();
  const now = new Date();
  const dateTime = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0');
  if (!amount || !description) return;
  const newTx = { type, amount, paymentMethod, description, date: dateTime };
  if (currentUser) {
    await saveTransactionToFirestore(newTx);
    await loadTransactionsFromFirestore();
  } else {
    const transactions = getTransactions();
    transactions.unshift(newTx);
    saveTransactions(transactions);
    renderTransactions();
  }
  this.reset();
});

// Auth state change
firebase.auth().onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    await loadTransactionsFromFirestore();
  } else {
    renderTransactions();
  }
  // ... existing avatar logic ...
  if (user) {
    avatarImg.src = user.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
  } else {
    avatarImg.src = 'https://www.gravatar.com/avatar/?d=mp';
  }
  hideUserPopup();
});

// Avatar and popup logic
const avatarBtn = document.getElementById('user-avatar-btn');
const avatarImg = document.getElementById('user-avatar-img');
const userPopup = document.getElementById('user-popup');

console.log("Avatar button:", avatarBtn, "Avatar img:", avatarImg);
avatarBtn.style.display = 'inline-block';
avatarImg.src = 'https://www.gravatar.com/avatar/?d=mp';

function showUserPopup(contentHtml) {
  userPopup.innerHTML = contentHtml;
  userPopup.style.display = 'block';
}

function hideUserPopup() {
  userPopup.style.display = 'none';
}

avatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const user = firebase.auth().currentUser;
  if (user) {
    showUserPopup(`
      <div style=\"text-align:center;\">
        <img src=\"${user.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}\" style=\"width:60px;height:60px;border-radius:50%;\" />
        <div style=\"margin:8px 0;\">${user.email}</div>
        <button id=\"logout-btn\">Logout</button>
      </div>
    `);
    document.getElementById('logout-btn').onclick = () => firebase.auth().signOut();
  } else {
    showUserPopup(`
      <div style=\"text-align:center;\">
        <button id=\"google-login-popup\">Sign in with Google</button>
      </div>
    `);
    document.getElementById('google-login-popup').onclick = () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      firebase.auth().signInWithPopup(provider);
    };
  }
});

document.addEventListener('click', (e) => {
  if (!userPopup.contains(e.target) && e.target !== avatarBtn) {
    hideUserPopup();
  }
});

// Payment method options logic
const typeSelect = document.getElementById('type');
const paymentMethodSelect = document.getElementById('payment-method');

function updatePaymentMethodOptions() {
  const type = typeSelect.value;
  paymentMethodSelect.innerHTML = '';
  if (type === 'gain') {
    paymentMethodSelect.innerHTML = `
      <option value="cash">Cash</option>
      <option value="online">Online</option>
    `;
  } else {
    paymentMethodSelect.innerHTML = `
      <option value="cash">Cash</option>
      <option value="card">Card</option>
      <option value="online">Online</option>
    `;
  }
}

typeSelect.addEventListener('change', updatePaymentMethodOptions);
// Initialize on page load
updatePaymentMethodOptions(); 
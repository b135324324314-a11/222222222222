let transactions = JSON.parse(localStorage.getItem('loloaTransactions')) || [];

function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(event) event.currentTarget.classList.add('active');
    if(tabId === 'list-tab') renderTransactions();
}

function openFormModal(id = null) {
    document.getElementById('formModal').style.display = 'block';
    document.getElementById('transactionId').value = '';
    
    // تصفير جميع الحقول
    document.querySelectorAll('.contract-paper input').forEach(inp => inp.value = '');
    
    if (id !== null) {
        // فتح معاملة محفوظة
        const txn = transactions.find(t => t.id === id);
        if(txn) {
            document.getElementById('transactionId').value = txn.id;
            for(let key in txn) {
                if(document.getElementById(key)) {
                    document.getElementById(key).value = txn[key];
                }
            }
        }
    } else {
        // معاملة جديدة: توليد رقم عشوائي
        document.getElementById('serialNo').value = Math.floor(10000 + Math.random() * 90000);
    }
}

function closeFormModal() {
    document.getElementById('formModal').style.display = 'none';
}

function saveTransaction() {
    const idField = document.getElementById('transactionId').value;
    const sellerName = document.getElementById('sellerName').value;
    const buyerName = document.getElementById('buyerName').value;
    
    if(!sellerName && !buyerName) {
        alert("يرجى إدخال اسم البائع أو المشتري على الأقل لحفظ الاستمارة!");
        return;
    }
    
    const txn = { id: idField ? parseInt(idField) : Date.now() };
    
    // جلب البيانات من كافة الحقول
    document.querySelectorAll('.contract-paper input').forEach(inp => {
        txn[inp.id] = inp.value;
    });
    
    if(idField) {
        const idx = transactions.findIndex(t => t.id === parseInt(idField));
        transactions[idx] = txn;
    } else {
        transactions.push(txn);
    }
    
    localStorage.setItem('loloaTransactions', JSON.stringify(transactions));
    alert('تم الحفظ في الأرشيف بنجاح!');
    closeFormModal();
    openTab('list-tab');
}

function renderTransactions(filtered = transactions) {
    const list = document.getElementById('transactionsList');
    list.innerHTML = '';
    
    if(filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; width:100%; font-size: 18px; color:#555;">لا توجد معاملات محفوظة.</p>';
        return;
    }
    
    // العرض من الأحدث للأقدم
    [...filtered].reverse().forEach(txn => {
        const div = document.createElement('div');
        div.className = 'transaction-card';
        div.innerHTML = `
            <h3 style="color:#d32f2f; margin-bottom: 10px;"><i class="fa-solid fa-file-contract"></i> عقد رقم: ${txn.serialNo || '---'}</h3>
            <p><strong><i class="fa-solid fa-user"></i> البائع:</strong> ${txn.sellerName || '---'}</p>
            <p><strong><i class="fa-solid fa-user-tie"></i> المشتري:</strong> ${txn.buyerName || '---'}</p>
            <p><strong><i class="fa-solid fa-car"></i> السيارة:</strong> ${txn.carMake || ''} - ${txn.carModel || ''}</p>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #ddd;">
            <div class="card-actions">
                <button class="btn-primary" style="flex:1" onclick="openFormModal(${txn.id})"><i class="fa-solid fa-eye"></i> معاينة وتعديل</button>
                <button class="btn-info" onclick="printTransaction(${txn.id})"><i class="fa-solid fa-print"></i></button>
                <button class="btn-danger" onclick="deleteTransaction(${txn.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(div);
    });
}

function deleteTransaction(id) {
    if(confirm('هل أنت متأكد من حذف هذه المعاملة نهائياً؟')) {
        transactions = transactions.filter(t => t.id !== id);
        localStorage.setItem('loloaTransactions', JSON.stringify(transactions));
        renderTransactions();
    }
}

function printTransaction(id) {
    openFormModal(id);
    setTimeout(() => { window.print(); }, 500);
}

function searchTransactions() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = transactions.filter(t => 
        (t.sellerName && t.sellerName.toLowerCase().includes(query)) || 
        (t.buyerName && t.buyerName.toLowerCase().includes(query)) ||
        (t.serialNo && t.serialNo.includes(query))
    );
    renderTransactions(filtered);
}

// تشغيل العرض عند فتح الصفحة
renderTransactions();

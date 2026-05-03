// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const CONFIG = {
  IMGBB_API_KEY: "d0c1b85400940c1d310e2256e9206d2c",
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyAFoqpXqAMMv56dxuGC_CmJh4Os5SgDQ6s",
    authDomain: "lkjllj-9bf15.firebaseapp.com",
    projectId: "lkjllj-9bf15",
    storageBucket: "lkjllj-9bf15.firebasestorage.app",
    messagingSenderId: "196700461829",
    appId: "1:196700461829:web:b00228d2f10db44b5cb56c"
  },
  COLLECTION_NAME: "products" // المعاملات/المنتجات
};

// تهيئة Firebase مع نظام الكاش القوي للعمل أوفلاين
const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

let transactions = [];
let deferredPrompt;

// --- نظام الحماية و تثبيت التطبيق PWA ---
window.checkPassword = function() {
    const pwd = document.getElementById('systemPassword').value;
    if (pwd === "10011") {
        document.getElementById('passwordOverlay').style.display = 'none';
        document.getElementById('mainAppContainer').style.display = 'block';
        if (deferredPrompt) {
            document.getElementById('installOverlay').style.display = 'flex';
        }
        loadTransactionsFromFirestore();
    }
};

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
        document.getElementById('installOverlay').style.display = 'none';
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
    }
});

window.skipInstall = function() {
    document.getElementById('installOverlay').style.display = 'none';
};

// --- عرض التبويبات والنماذج ---
window.openTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(event) event.currentTarget.classList.add('active');
    if(tabId === 'list-tab') renderTransactions();
};

window.openFormModal = function(id = null) {
    document.getElementById('formModal').style.display = 'block';
    document.getElementById('transactionId').value = '';
    document.getElementById('imageUpload').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('savedImageUrl').value = '';
    document.getElementById('savedDeleteUrl').value = '';
    
    document.querySelectorAll('.contract-paper input').forEach(inp => inp.value = '');
    
    if (id !== null) {
        const txn = transactions.find(t => t.id === id);
        if(txn) {
            document.getElementById('transactionId').value = txn.id;
            for(let key in txn) {
                if(document.getElementById(key)) {
                    document.getElementById(key).value = txn[key];
                }
            }
            if(txn.imageUrl) {
                document.getElementById('savedImageUrl').value = txn.imageUrl;
                document.getElementById('savedDeleteUrl').value = txn.deleteUrl;
                document.getElementById('imagePreview').src = txn.imageUrl;
                document.getElementById('imagePreviewContainer').style.display = 'block';
            }
        }
    } else {
        document.getElementById('serialNo').value = Math.floor(10000 + Math.random() * 90000);
    }
};

window.closeFormModal = function() {
    document.getElementById('formModal').style.display = 'none';
};

// --- ضغط الصورة ورفعها ---
window.previewSelectedImage = function(event) {
    const file = event.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreviewContainer').style.display = 'block';
        }
        reader.readAsDataURL(file);
    }
};

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1000;
                if(width > MAX_SIZE || height > MAX_SIZE) {
                    if(width > height) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                    else { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
            };
        };
    });
}

async function uploadToImgBB(fileBlob) {
    const formData = new FormData();
    formData.append('image', fileBlob, 'transaction.jpg');
    try {
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if(data.success) {
            return { url: data.data.url, deleteUrl: data.data.delete_url };
        }
    } catch (error) {
        console.error("خطأ في رفع الصورة", error);
    }
    return null;
}

// --- الحفظ إلى Firestore ---
window.saveTransaction = async function() {
    const sellerName = document.getElementById('sellerName').value;
    const buyerName = document.getElementById('buyerName').value;
    
    if(!sellerName && !buyerName) {
        alert("يرجى إدخال اسم البائع أو المشتري على الأقل!");
        return;
    }

    const btn = document.querySelector('.btn-success');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
    btn.disabled = true;

    try {
        let imageUrl = document.getElementById('savedImageUrl').value;
        let deleteUrl = document.getElementById('savedDeleteUrl').value;
        
        const fileInput = document.getElementById('imageUpload');
        if(fileInput.files.length > 0) {
            const compressedBlob = await compressImage(fileInput.files[0]);
            const uploadResult = await uploadToImgBB(compressedBlob);
            if(uploadResult) {
                imageUrl = uploadResult.url;
                deleteUrl = uploadResult.deleteUrl;
            }
        }

        const txnData = { 
            name: sellerName || "بدون اسم",
            price: document.getElementById('price').value || "",
            imageUrl: imageUrl || "",
            deleteUrl: deleteUrl || "",
            createdAt: new Date().toISOString()
        };

        // جمع باقي الحقول من الاستمارة
        document.querySelectorAll('.contract-paper input').forEach(inp => {
            if(inp.id && inp.id !== 'transactionId') {
                txnData[inp.id] = inp.value;
            }
        });

        const idField = document.getElementById('transactionId').value;
        if(idField) {
            await updateDoc(doc(db, CONFIG.COLLECTION_NAME, idField), txnData);
        } else {
            await addDoc(collection(db, CONFIG.COLLECTION_NAME), txnData);
        }

        alert('تم الحفظ بنجاح!');
        closeFormModal();
        await loadTransactionsFromFirestore();
        openTab('list-tab');

    } catch (error) {
        alert("حدث خطأ أثناء الحفظ");
        console.error(error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// --- استدعاء وعرض وحذف البيانات ---
async function loadTransactionsFromFirestore() {
    try {
        const querySnapshot = await getDocs(collection(db, CONFIG.COLLECTION_NAME));
        transactions = [];
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            data.id = doc.id;
            transactions.push(data);
        });
        renderTransactions();
    } catch (error) {
        console.error("خطأ في جلب البيانات", error);
    }
}

function renderTransactions(filtered = transactions) {
    const list = document.getElementById('transactionsList');
    list.innerHTML = '';
    
    if(filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; width:100%; font-size: 18px; color:#555;">لا توجد معاملات محفوظة.</p>';
        return;
    }
    
    [...filtered].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(txn => {
        const div = document.createElement('div');
        div.className = 'transaction-card';
        
        let imgHtml = '';
        if(txn.imageUrl) {
            imgHtml = `<div class="card-image-box" onclick="openLightbox('${txn.imageUrl}')"><img src="${txn.imageUrl}" alt="صورة المعاملة"></div>`;
        }

        div.innerHTML = `
            <div class="card-content">
                <div class="card-details">
                    <h3 style="color:#d32f2f; margin-bottom: 10px;"><i class="fa-solid fa-file-contract"></i> عقد رقم: ${txn.serialNo || '---'}</h3>
                    <p><strong><i class="fa-solid fa-user"></i> البائع:</strong> ${txn.sellerName || '---'}</p>
                    <p><strong><i class="fa-solid fa-user-tie"></i> المشتري:</strong> ${txn.buyerName || '---'}</p>
                    <p><strong><i class="fa-solid fa-car"></i> السيارة:</strong> ${txn.carMake || ''} - ${txn.carModel || ''}</p>
                </div>
                ${imgHtml}
            </div>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #ddd;">
            <div class="card-actions">
                <button class="btn-primary" style="flex:1" onclick="openFormModal('${txn.id}')"><i class="fa-solid fa-eye"></i> معاينة</button>
                <button class="btn-info" onclick="printTransaction('${txn.id}')"><i class="fa-solid fa-print"></i></button>
                <button class="btn-danger" onclick="deleteTransaction('${txn.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.deleteTransaction = async function(id) {
    if(confirm('هل أنت متأكد من حذف هذه المعاملة نهائياً؟')) {
        const txn = transactions.find(t => t.id === id);
        
        // تنفيذ شرط حذف الصورة من API كما طلب المستخدم
        if(txn && txn.deleteUrl) {
            try {
                await fetch(txn.deleteUrl);
            } catch(e) {
                console.log("تنبيه: API ImgBB قد ترفض الحذف من الواجهة الأمامية، يتم استكمال حذف السجل.");
            }
        }
        
        try {
            await deleteDoc(doc(db, CONFIG.COLLECTION_NAME, id));
            await loadTransactionsFromFirestore();
        } catch(error) {
            alert("خطأ في الحذف");
        }
    }
};

window.printTransaction = function(id) {
    openFormModal(id);
    setTimeout(() => { window.print(); }, 500);
};

window.searchTransactions = function() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = transactions.filter(t => 
        (t.sellerName && t.sellerName.toLowerCase().includes(query)) || 
        (t.buyerName && t.buyerName.toLowerCase().includes(query)) ||
        (t.serialNo && String(t.serialNo).includes(query))
    );
    renderTransactions(filtered);
};

// --- نافذة الصور المكبرة (Lightbox) ---
window.openLightbox = function(src) {
    document.getElementById('lightboxImage').src = src;
    document.getElementById('lightboxModal').style.display = 'block';
};

window.closeLightbox = function() {
    document.getElementById('lightboxModal').style.display = 'none';
};

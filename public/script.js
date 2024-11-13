let ws;
let countdownInterval;
let nextVoteInterval;

function connectWebSocket() {
  ws = new WebSocket(`ws://efjp6ppvfv.eu-central-1.awsapprunner.com:80`);

  ws.onopen = () => {
    console.log("WebSocket bağlantısı açık.");
  };

  ws.onclose = () => {
    console.log("WebSocket bağlantısı kapalı, yeniden bağlanıyor...");
    setTimeout(connectWebSocket, 1000); // 1 saniye sonra yeniden bağlanmayı dene
  };

  ws.onerror = (error) => {
    console.error("WebSocket hatası:", error);
    ws.close(); // Bağlantıyı kapat ve yeniden başlatmayı sağla
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'init' || message.type === 'update') {
      updateRace(message.data);
    } else if (message.type === 'reset') {
      updateRace(message.data);
      document.getElementById('message').innerText = 'Yeni yarış başladı!';
    } else if (message.type === 'error') {
      document.getElementById('message').innerText = message.message;
    }else if (message.type === 'online-users') {
      document.getElementById('online-users').innerText = `Online Kullanıcı Sayısı: ${message.count}`;
    }
  };
}

function voteForRace(department) {
  const lastVoteTime = localStorage.getItem('lastRaceVoteTime');
  const currentTime = Date.now();

  // Eğer son oy kullanımı 5 dakikadan önceyse oy vermeyi kısıtla
  if (lastVoteTime && currentTime - lastVoteTime < 5 * 60 * 1000) {
    const timeRemaining = 5 * 60 * 1000 - (currentTime - lastVoteTime);
    startNextVoteTimer(timeRemaining); // Kalan süreyi göster
    document.getElementById('message').innerText = '5 Dakika Dolmadan Oy Kullanamazsınız.';
    return;
  }

  // Eğer bağlantı açıksa oyu gönder ve zamanı kaydet
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'race-vote', department })); // WebSocket üzerinden yarış oyu gönder
    document.getElementById('message').innerText = 'Yarış için oyunuzu verdiniz, 5 dakika bekleyin.';
    
    // Oy zamanı kaydedilir ve geri sayım başlatılır
    localStorage.setItem('lastRaceVoteTime', Date.now());
    startNextVoteTimer(5 * 60 * 1000); // 5 dakikalık geri sayımı başlat
  } else {
    document.getElementById('message').innerText = 'Bağlantı kapalı, yeniden bağlanıyor...';
  }
}

// Geri sayım işlevi
function startNextVoteTimer(duration) {
  clearInterval(nextVoteInterval);
  const endTime = Date.now() + duration;

  function updateNextVoteTimer() {
    const timeLeft = endTime - Date.now();
    if (timeLeft <= 0) {
      clearInterval(nextVoteInterval);
      document.getElementById('next-vote-timer').innerText = 'Bir sonraki oy zamanı geldi!';
    } else {
      const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
      const seconds = Math.floor((timeLeft / 1000) % 60);
      document.getElementById('next-vote-timer').innerText = `Bir Sonraki Oy için Kalan süre: ${minutes} dk ${seconds} sn`;
    }
  }

  updateNextVoteTimer();
  nextVoteInterval = setInterval(updateNextVoteTimer, 1000);
}

window.onload = () => {
  connectWebSocket();

  // Sayfa yüklendiğinde, kalan süreyi kontrol et ve geri sayımı başlat
  const lastVoteTime = localStorage.getItem('lastRaceVoteTime');
  if (lastVoteTime) {
    const elapsed = Date.now() - lastVoteTime;
    if (elapsed < 5 * 60 * 1000) {
      startNextVoteTimer(5 * 60 * 1000 - elapsed);
    }
  }
};


function voteForPoll(type) {
  fetch(`/api/vote?type=${type}`, { method: "POST" })
    .then((response) => {
      // Eğer kullanıcı zaten oy vermişse 403 durum kodunu kontrol et
      if (response.status === 403) {
        alert("Zaten Oy Verdin! Oy Hakkın Saatte Bir Yenilenecektir.");
        return null; // Eğer oy verilmişse veriyi işleme
      }
      return response.json();
    })
    .then((data) => {
      // Eğer veri null değilse butonları güncelle
      if (data) {
        document.getElementById(type + 'Count').textContent = data[type];
        
        // Happy-sad yüzdelerini yeniden hesapla ve güncelle
        const totalVotes = data.happy + data.sad;
        document.getElementById("happyPercent").textContent = ((data.happy / totalVotes) * 100).toFixed(1);
        document.getElementById("sadPercent").textContent = ((data.sad / totalVotes) * 100).toFixed(1);
      }
    })
    .catch((err) => console.error("Happy-sad oylaması sırasında hata:", err));
}


function updateRace(data) {
  Object.keys(data.departments).forEach((department) => {
    const votes = data.departments[department];
    const progress = Math.min((Math.log10(votes + 1) / Math.log10(130+ 1)) * 100, 100);
    const circle = document.getElementById(`${department}-circle`);
    circle.style.left = `${progress}%`;
    const button = document.querySelector(`button[onclick="voteForRace('${department}')"]`);
    if (button) {
      button.innerHTML = `${button.textContent.trim().split(' ')[0]} ${department} (${votes} oy)`;
    }
  });
}

window.onload = () => {
  connectWebSocket();

  // Sayfa yüklendiğinde, kalan süreyi kontrol et ve geri sayımı başlat
  const lastVoteTime = localStorage.getItem('lastVoteTime');
  if (lastVoteTime) {
    const elapsed = Date.now() - lastVoteTime;
    if (elapsed < 5 * 60 * 1000) {
      startNextVoteTimer(5 * 60 * 1000 - elapsed);
    }
  }
// Kazanan departmanların toplam sayısını hesaplama fonksiyonu
function calculateDepartmentWins(winners) {
    const winCounts = {};
  
    winners.forEach((winner) => {
      const department = winner.winner;
      if (winCounts[department]) {
        winCounts[department] += 1;
      } else {
        winCounts[department] = 1;
      }
    });
  
    return winCounts;
  }
  // Kazanma sayısını her bölüm için hesaplayıp tabloyu sıralı bir şekilde doldurma
function populateSummaryTable(winCounts) {
    // Kazanma sayısına göre sıralanmış veriler
    const sortedWinCounts = Object.entries(winCounts).sort((a, b) => b[1] - a[1]);
    const tableBody = document.getElementById("summary-table-body");
    tableBody.innerHTML = ''; // Mevcut tabloyu temizle
  
    sortedWinCounts.forEach(([department, count], index) => {
      const row = document.createElement("tr");
  
      // Sıra numarası sütunu
      const rankCell = document.createElement("td");
      rankCell.className = "border border-gray-300 px-4 py-2 text-center font-bold";
      rankCell.textContent = index + 1; // Sıra numarası 1'den başlıyor
      row.appendChild(rankCell);
  
      // Bölüm adı sütunu, en üstteki bölüme "👑" simgesi eklenir
      const deptCell = document.createElement("td");
      deptCell.textContent = index === 0 ? `👑 ${department}` : department;
      deptCell.className = "border border-gray-300 px-4 py-2 text-center";
      row.appendChild(deptCell);
  
      // Kazanç sayısı sütunu
      const countCell = document.createElement("td");
      countCell.textContent = count;
      countCell.className = "border border-gray-300 px-4 py-2 text-center";
      row.appendChild(countCell);
  
      tableBody.appendChild(row);
    });
  }
  // Detaylı kazananlar tablosunu doldurma fonksiyonu
function populateDetailsTable(winners) {
    const tableBody = document.getElementById("details-table-body");
    tableBody.innerHTML = ''; // Önce tabloyu temizle
  
    winners.forEach((winner, index) => {
      const row = document.createElement("tr");
  
      // Yarış ID hücresi
      const idCell = document.createElement("td");
      idCell.textContent = index + 1; // Yarış ID
      idCell.className = "border border-gray-300 px-4 py-2";
      row.appendChild(idCell);
  
      // Kazanan bölüm hücresi
      const deptCell = document.createElement("td");
      deptCell.textContent = winner.winner;
      deptCell.className = "border border-gray-300 px-4 py-2";
      row.appendChild(deptCell);
  
      // Oy sayısı hücresi
      //const votesCell = document.createElement("td");
      //votesCell.textContent = winner.votes;
      //votesCell.className = "border border-gray-300 px-4 py-2";
      //row.appendChild(votesCell);
  
      // Başlangıç zamanı hücresi
      //const startTimeCell = document.createElement("td");
      //startTimeCell.textContent = new Date(winner.startTime).toLocaleString();
      //startTimeCell.className = "border border-gray-300 px-4 py-2";
      //row.appendChild(startTimeCell);
  
      // Bitiş zamanı hücresi
      const endTimeCell = document.createElement("td");
      endTimeCell.textContent = new Date(winner.endTime).toLocaleString();
      endTimeCell.className = "border border-gray-300 px-4 py-2";
      row.appendChild(endTimeCell);
  
      tableBody.appendChild(row);
    });
  }
  
  fetch('/api/data')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      const winCounts = calculateDepartmentWins(data.winners);
      populateSummaryTable(winCounts);
      populateDetailsTable(data.winners);
    })
    .catch(error => {
      console.error("Error fetching data:", error);
      document.getElementById("message").innerText = "Veri yüklenemedi.";
    });
};

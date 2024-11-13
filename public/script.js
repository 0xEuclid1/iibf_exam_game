let ws;
let countdownInterval;
let nextVoteInterval;

function fetchRaceData() {
  fetch('/api/race-data')
      .then(response => response.json())
      .then(data => updateRace(data))
      .catch(error => console.error('Error fetching race data:', error));
}
// Her 5 saniyede bir yarış verilerini güncelle
setInterval(fetchRaceData, 1000);

function voteForRace(department) {
  const lastVoteTime = localStorage.getItem('lastRaceVoteTime');
  const currentTime = Date.now();

  if (lastVoteTime && currentTime - lastVoteTime < 5 * 60 * 1000) {
      document.getElementById('message').innerText = '5 Dakika Dolmadan Oy Kullanamazsınız.';

      return;
  }

  fetch('/api/race-vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department })
  })
  .then(response => response.json())
  .then(data => {
      document.getElementById('message').innerText = data.message;
      localStorage.setItem('lastRaceVoteTime', Date.now());
  })
  .catch(error => console.error('Error voting for race:', error));
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  console.log(`Cookie '${name}' deletion attempted. Current cookies:`, document.cookie);
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
          
          // Clear the cookie and localStorage
          localStorage.removeItem("lastRaceVoteTime");
          fetch('/api/clear-race-vote').then(() => console.log("hasRaceVoted cookie cleared"));
          
      } else {
          const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
          const seconds = Math.floor((timeLeft / 1000) % 60);
          document.getElementById('next-vote-timer').innerText = `Bir Sonraki Oy için Kalan süre: ${minutes} dk ${seconds} sn`;
      }
  }

  updateNextVoteTimer();
  nextVoteInterval = setInterval(updateNextVoteTimer, 1000);
}


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
  Object.keys(data.departments).forEach(department => {
      const votes = data.departments[department];
      const progress = Math.min((Math.log10(votes + 1) / Math.log10(130 + 1)) * 100, 100);
      
      const circle = document.getElementById(`${department}-circle`);
      circle.style.left = `${progress}%`;

      const button = document.querySelector(`button[onclick="voteForRace('${department}')"]`);
      
      if (button) {
          button.innerHTML = `${button.textContent.trim().split(' ')[0]} ${department} (${votes} oy)`;
      }
  });

  // 5 dakikalık geri sayımı başlat
  function startCountdown() {
      const lastVoteTime = localStorage.getItem('lastRaceVoteTime');
      if (lastVoteTime) {
          const elapsed = (Date.now() - lastVoteTime) / 1000; // saniye cinsinden
          const remaining = Math.max(300 - elapsed, 0); // 300 saniye = 5 dakika
          const countdownElement = document.getElementById('next-vote-timer');
          if (countdownElement) {
              countdownElement.innerHTML = `Bir Sonraki Oy için Kalan Süre: ${Math.floor(remaining / 60)} dakika ${Math.floor(remaining % 60)} saniye`;
          }

          if (remaining > 0) {
              setTimeout(startCountdown, 1000);
          }else {
            localStorage.removeItem('lastRaceVoteTime');
        }
      }
  }

  startCountdown();
}
// Her 5 saniyede bir yarış verilerini güncelle
setInterval(() => {
  fetch('/api/race-data')
      .then(response => response.json())
      .then(data => updateRace(data))
      .catch(error => console.error('Error fetching race data:', error));
}, 5000);

window.onload = () => {
 

  const lastVoteTime = localStorage.getItem('lastRaceVoteTime');
  if (lastVoteTime) {
      const elapsed = Date.now() - lastVoteTime;

      if (elapsed < 5 * 60 * 1000) {
          // Start countdown with remaining time
          startNextVoteTimer(5 * 60 * 1000 - elapsed);
      } else {
          // Clear expired lastRaceVoteTime and cookie immediately
          localStorage.removeItem("lastRaceVoteTime");
          fetch('/api/clear-race-vote').then(() => console.log("hasRaceVoted cookie cleared"));
        
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

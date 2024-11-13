const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const http = require('http');
const WebSocket = require('ws');
let onlineUsers = 0; // A


const app = express();
const PORT = process.env.PORT || 80;
const DATA_PATH = path.join(__dirname, 'database.json');

const MAX_VOTES = 100; // Winner vote threshold
let dbCache = loadDatabase();
// HTTP Server setup
const server = http.createServer(app); // HTTP sunucusu oluştur
const wss = new WebSocket.Server({ server }); // WebSocket sunucusunu HTTP sunucusuna bağla
console.log(`WebSocket server is running on ws://localhost:${PORT}`);

// Middleware tanımlamaları
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static("public"));
// WebSocket connection setup
wss.on('connection', (ws) => {
	ws.lastVoteTime = 0; // Initialize last vote time
	onlineUsers++; // Yeni bağlantıda kullanıcı sayısını artır
  broadcastOnlineUsers(); // Tüm istemcilere güncellenmiş kullanıcı sayısını gönder
  
	ws.send(JSON.stringify({ type: 'init', data: dbCache }));
    ws.on('close', () => {
		onlineUsers--; // Bağlantı kapandığında kullanıcı sayısını azalt
		broadcastOnlineUsers(); // Tüm istemcilere güncellenmiş kullanıcı sayısını gönder
	  });

	ws.on('message', (message) => {
	  const { department } = JSON.parse(message);
	  const currentTime = Date.now();
  
	  // Check if user has voted in the last 5 minutes
	  if (currentTime - ws.lastVoteTime < 5 * 60 * 1000) {
		ws.send(JSON.stringify());
		return;
	  }
  
	  // Increase vote count if department exists
	  if (dbCache.departments[department] !== undefined) {
		dbCache.departments[department] += 1;
		ws.lastVoteTime = currentTime; // Update last vote time
		updateDatabase(dbCache); // Save database immediately
  
		// Check if there's a winner after the vote
		const winner = checkWinner(dbCache.departments);
		if (winner) {
		  resetRace(winner); // Reset the race if a winner is found
		} else {
		  wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
			  client.send(JSON.stringify({ type: 'update', data: dbCache }));
			}
		  });
		}
	  }
	});

	
  });

  // Online kullanıcı sayısını tüm istemcilere yayınlayan fonksiyon
function broadcastOnlineUsers() {
  const message = JSON.stringify({ type: 'online-users', count: onlineUsers });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
// Dosya yolları
const counterFilePath = path.join(__dirname, "data", "counter.json");
const counterLogFilePath = path.join(__dirname, "data","counter.log");

const voteFilePath = path.join(__dirname, "data", "vote.json");
const voteLogFilePath = path.join(__dirname, "data","vote.log");



//// Race APP


// Load data from JSON file
function loadDatabase() {
	try {
	  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
	  if (!data.winners) {
		data.winners = [];
	  }
	  return data;
	} catch (err) {
	  console.error("Error loading database:", err);
	  return { departments: { "ECON": 0, "IKT": 0, "ISL": 0, "SBKY": 0, "UTL": 0 }, winners: [] };
	}
  }
  
  // Update JSON file function
  function updateDatabase(data) {
	try {
	  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
	} catch (err) {
	  console.error("Error updating database:", err);
	}
  }
  
  // Check if any department has reached the threshold to win
  function checkWinner(departments) {
	for (const department in departments) {
	  if (departments[department] >= MAX_VOTES) {
		return department;
	  }
	}
	return null;
  }
  
  // Reset the race after a department wins
  function resetRace(winner) {
	const currentTime = new Date();
  
	dbCache.winners.push({
	  winner: winner,
	  votes: dbCache.departments[winner],
	  startTime: new Date(currentTime.getTime() - MAX_VOTES).toISOString(),
	  endTime: currentTime.toISOString()
	});
  
	dbCache.departments = { ECON: 0, IKT: 0, ISL: 0, SBKY: 0, UTL: 0 };
	updateDatabase(dbCache); // Save reset data immediately
  
	// Notify all clients about the reset
	wss.clients.forEach((client) => {
	  if (client.readyState === WebSocket.OPEN) {
		client.send(JSON.stringify({ type: 'reset', data: dbCache }));
	  }
	});
  }
  
// Tekil /api/data endpoint
app.get('/api/data', (req, res) => {
	try {
	  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
	  res.json(data);
	} catch (err) {
	  console.error("Error reading database:", err);
	  res.status(500).json({ error: "Failed to load data" });
	}
  });
  

















////Race APP









// Vote dosyasının varlığını kontrol et, yoksa başlangıç değerleri ile oluştur
if (!fs.existsSync(voteFilePath)) {
	fs.writeFileSync(voteFilePath, JSON.stringify({ happy: 0, sad: 0 }, null, 2));
}

// Logs endpoint
app.get("/api/logs", (req, res) => {
	try {
		const readLogFile = (filePath) => {
			if (!fs.existsSync(filePath)) return [];
			const data = fs.readFileSync(filePath, "utf8").trim();
			return data
				.split("\n")
				.filter((line) => line) // Boş satırları filtrele
				.map((line) => {
					const [date, time, message] = line.split(" - ");
					return { date, time, message };
				});
		};

		// Dosyaları satır bazında oku ve işle
		const voteLog = readLogFile(voteLogFilePath);
		const counterLog = readLogFile(counterLogFilePath);

		// Her iki log dosyasını daha temiz bir JSON olarak döndür
		res.json({
			voteLog,
			counterLog,
		});
	} catch (error) {
		console.error("Error reading log files:", error);
		res.status(500).json({ message: "Error reading log files." });
	}
});

// Ziyaretçi sayısını oku veya sıfırdan başlat
function readCounter() {
	if (!fs.existsSync(counterFilePath)) {
		return 0;
	}
	const data = fs.readFileSync(counterFilePath, "utf8");
	return JSON.parse(data).count;
}

// Ziyaretçi sayısını güncelle
function updateCounter() {
	const count = readCounter() + 1;
	fs.writeFileSync(counterFilePath, JSON.stringify({ count }, null, 4));
		// Loglama işlemi
		const logEntry = `${new Date().toISOString()} - Visitor count updated to: ${count}\n`;
		fs.appendFileSync(counterLogFilePath, logEntry, "utf8");
	return count;
}

function getCurrentDateInTurkey() {
	const now = new Date();
	const turkishOffset = 3 * 60; // GMT+3 için dakika cinsinden
	const localOffset = now.getTimezoneOffset();
	return new Date(now.getTime() + (turkishOffset + localOffset) * 60 * 1000);
}

app.get("/api/ziyaretci-sayaci", (req, res) => {
	const count = updateCounter();
	res.send({ count });
});

app.get("/api/duyurular", (req, res) => {
	fs.readFile(
		path.join(__dirname, "data", "duyurular.json"),
		"utf8",
		(err, data) => {
			if (err) {
				return res
					.status(500)
					.send({ message: "Dosya okunurken bir hata oluştu." });
			}
			const duyurular = JSON.parse(data);
			const currentDate = getCurrentDateInTurkey();
			const filteredDuyurular = duyurular.filter((duyuru) => {
				const yayinTarihi = new Date(duyuru.yayin_tarihi);
				const fark = yayinTarihi - currentDate;
				return yayinTarihi <= currentDate || (fark > 0 && fark <= 30 * 60 * 1000); // 30 dakika veya daha az kaldıysa
			});

			// Ek kontrol
			if (filteredDuyurular.length === duyurular.length) {
				console.warn(
					"Tüm duyurular istemciye gönderiliyor. Filtreleme mantığını kontrol edin."
				);
			}

			res.send(filteredDuyurular);
		}
	);
});

// Duyuru ekle
app.post("/api/duyuru-ekle", (req, res) => {
	const yeniDuyuru = req.body;
	fs.readFile(
		path.join(__dirname, "data", "duyurular.json"),
		"utf8",
		(err, data) => {
			if (err) {
				return res
					.status(500)
					.send({ message: "Dosya okunurken bir hata oluştu." });
			}
			const duyurular = JSON.parse(data);
			yeniDuyuru.id = duyurular.length
				? duyurular[duyurular.length - 1].id + 1
				: 1;
			duyurular.push(yeniDuyuru);
			fs.writeFile(
				path.join(__dirname, "data", "duyurular.json"),
				JSON.stringify(duyurular, null, 4),
				(err) => {
					if (err) {
						return res
							.status(500)
							.send({ message: "Duyuru kaydedilirken bir hata oluştu." });
					}
					res.send({ message: "Duyuru başarıyla eklendi." });
				}
			);
		}
	);
});

// Duyuru güncelle
app.put("/api/duyuru-guncelle/:id", (req, res) => {
	const id = parseInt(req.params.id);
	const updatedField = req.body;

	fs.readFile(
		path.join(__dirname, "data", "duyurular.json"),
		"utf8",
		(err, data) => {
			if (err) {
				return res
					.status(500)
					.send({ message: "Dosya okunurken bir hata oluştu." });
			}
			let duyurular = JSON.parse(data);
			const duyuruIndex = duyurular.findIndex((d) => d.id === id);
			if (duyuruIndex > -1) {
				duyurular[duyuruIndex] = { ...duyurular[duyuruIndex], ...updatedField };
				fs.writeFile(
					path.join(__dirname, "data", "duyurular.json"),
					JSON.stringify(duyurular, null, 4),
					(err) => {
						if (err) {
							return res
								.status(500)
								.send({ message: "Duyuru güncellenirken bir hata oluştu." });
						}
						res.send({ message: "Duyuru başarıyla güncellendi." });
					}
				);
			} else {
				res.status(404).send({ message: "Duyuru bulunamadı." });
			}
		}
	);
});

// Counter dosyasının varlığını kontrol et, yoksa başlangıç değerleri ile oluştur


// Oy kullanma işlemi
// Mevcut /api/vote endpoint’ini sadece happy-sad oylaması için kullanın
app.post("/api/vote", (req, res) => {
	const type = req.query.type;
	const voteCookie = req.cookies && req.cookies.hasVoted;
	const counters = JSON.parse(fs.readFileSync(voteFilePath, "utf8"));

	// Eğer daha önce happy-sad oyu verildiyse mesaj döndür
	if (voteCookie) {
		return res.status(403).json({ message: "You have already voted for happy-sad poll." });
	}

	// Oy tipine göre sayıyı artır
	if (type === "happy") {
		counters.happy += 1;
	} else if (type === "sad") {
		counters.sad += 1;
	}

	fs.writeFileSync(voteFilePath, JSON.stringify(counters, null, 2));

	// Oy verdikten sonra çerez ayarla (1 saat geçerli)
	res.cookie("hasVoted", true, { maxAge: 60 * 60 * 1000, httpOnly: true });
	const logEntry = `${new Date().toISOString()} - Vote: ${type}\n`;
	fs.appendFileSync(voteLogFilePath, logEntry, "utf8");
	res.json(counters);
});


// Yarış oylama işlemi için yeni endpoint
app.post("/api/race-vote", (req, res) => {
	const { department } = req.body; // Yarış oyu için departman bilgisi alınır
	const raceVoteCookie = req.cookies && req.cookies.hasRaceVoted;

	// Eğer daha önce yarışa oy verildiyse mesaj döndür
	if (raceVoteCookie) {
		return res.status(403).json({ message: "You have already voted for the race." });
	}

	// Departmana göre oy sayısını artır
	if (dbCache.departments[department] !== undefined) {
		dbCache.departments[department] += 1;
		updateDatabase(dbCache); // Veritabanını güncelle
		const winner = checkWinner(dbCache.departments);
		if (winner) {
			resetRace(winner); // Kazanan varsa yarışı sıfırla
		} else {
			// Tüm istemcilere güncellemeyi gönder
			wss.clients.forEach((client) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify({ type: 'race-update', data: dbCache }));
				}
			});
		}

		// Yarış oylaması çerezini ayarla (1 saat geçerli)
		res.cookie("hasRaceVoted", true, { maxAge: 60 * 60 * 1000, httpOnly: true });
		return res.json({ message: "Race vote registered successfully." });
	} else {
		return res.status(400).json({ message: "Invalid department." });
	}
});


// Duyuru sil
app.delete("/api/duyuru-sil/:id", (req, res) => {
	const id = parseInt(req.params.id);

	fs.readFile(
		path.join(__dirname, "data", "duyurular.json"),
		"utf8",
		(err, data) => {
			if (err) {
				return res
					.status(500)
					.send({ message: "Dosya okunurken bir hata oluştu." });
			}
			let duyurular = JSON.parse(data);
			duyurular = duyurular.filter((d) => d.id !== id);
			fs.writeFile(
				path.join(__dirname, "data", "duyurular.json"),
				JSON.stringify(duyurular, null, 4),
				(err) => {
					if (err) {
						return res
							.status(500)
							.send({ message: "Duyuru silinirken bir hata oluştu." });
					}
					res.send({ message: "Duyuru başarıyla silindi." });
				}
			);
		}
	);
});

// Oy durumu sorgula
app.get("/api/vote", (req, res) => {
	const counters = JSON.parse(fs.readFileSync(voteFilePath, "utf8"));
	res.json(counters);
});

module.exports = app;
server.listen(PORT, () => {
	console.log(`Sunucu ${PORT} portunda çalışıyor.`);
});

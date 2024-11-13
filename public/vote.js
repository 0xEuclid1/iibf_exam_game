async function vote(type) {
	try {
		const response = await fetch(`/api/vote?type=${type}`, {
			method: "POST",
		});
		
		// Kullanıcı daha önce oy vermişse uyarı göster
		if (response.status === 403) {
			alert("Zaten Oy Verdin! Oy Hakkın Saatte Bir Yenilenecektir.");
			return;
		}

		const result = await response.json();
		updateResults(result);
	} catch (error) {
		console.error("An error occurred:", error);
	}
}

function updateResults(data) {
	const total = data.happy + data.sad;
	const happyPercent = total ? ((data.happy / total) * 100).toFixed(2) : 0;
	const sadPercent = total ? ((data.sad / total) * 100).toFixed(2) : 0;

	document.getElementById("happyCount").innerText = data.happy;
	document.getElementById("happyPercent").innerText = happyPercent;
	document.getElementById("sadCount").innerText = data.sad;
	document.getElementById("sadPercent").innerText = sadPercent;
}

// İlk sayfa yüklendiğinde anket sonuçlarını güncelle
fetch("/api/vote")
	.then((response) => response.json())
	.then((data) => updateResults(data))
	.catch((error) => console.error("An error occurred:", error));

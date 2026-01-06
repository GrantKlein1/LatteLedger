console.log("Popup loaded");

document.addEventListener("DOMContentLoaded", () => {
  const checkBtn = document.getElementById("checkBtn");

  
  chrome.storage.local.get({ coinCount: 0 }, (items) => {
    const coinCountElement = document.getElementById("coinCount");
    coinCountElement.innerText = `Sumites: ${items.coinCount}`;
    coinCountElement.style.backgroundImage = "url('images/Carbon_fiber.jpg')";
    coinCountElement.style.backgroundSize = "cover";
  });

    chrome.storage.sync.get({ theme: "default" }, (items) => {
      const theme = items.theme;

    let buttonImage;
    switch (theme) {
      case "default":
        buttonImage = "images/icon.png";
        checkBtn.style.color = "white";
        break;
      case "futuristic":
        buttonImage = "images/futuristic1.gif";
        checkBtn.style.color = "white";
        break;
      case "medieval":
        buttonImage = "images/Medieval_still.png";
        checkBtn.style.color = "white";
        break;
      case "retro":
        buttonImage = "images/Retro_still.png";
        checkBtn.style.color = "white";
        break;
      case "default2":
        buttonImage = "images/icon.png";
        checkBtn.style.color = "white";
        break;
      case "psycho":
        buttonImage = "images/Kitten_gif.gif";
        checkBtn.style.color = "white";
        break;
      default:
        buttonImage = "images/icon.png";
        checkBtn.style.color = "white";
    }

    checkBtn.style.backgroundImage = `url(${buttonImage})`;
  });

  checkBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ theme: "default" }, (items) => {
    const theme = items.theme;

    let buttonImage;
    switch (theme) {
      case "default":
        buttonImage = "images/Phishing_gif.gif";
        checkBtn.style.color = "black";
        break;
      case "futuristic":
        buttonImage = "images/futuristic2.gif";
        checkBtn.style.color = "white";
        break;
      case "medieval":
        buttonImage = "images/Medieval_gif.gif";
        checkBtn.style.color = "white";
        break;
      case "retro":
        buttonImage = "images/Retro_gif.gif";
        checkBtn.style.color = "black";
        break;
      case "default2":
        buttonImage = "images/default2_gif.gif";
        checkBtn.style.color = "black";
        break;
      case "psycho":
        buttonImage = "images/Parrot_gif.gif";
        checkBtn.style.color = "white";
        break;
      default:
        buttonImage = "images/Phishing_gif.gif";
        checkBtn.style.color = "white";
    }

    checkBtn.style.backgroundImage = `url(${buttonImage})`;
  });

    checkBtn.classList.add("playing");
    checkBtn.innerText = "Checking...";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["contentScript.js"],
      }).catch((err) => console.error("Script injection failed:", err));
    });

    chrome.storage.local.get({ coinCount: 0 }, (items) => {
      const coinCountElement = document.getElementById("coinCount");
      coinCountElement.innerText = `Sumites: ${items.coinCount}`;
    });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "COIN_COUNT_UPDATED") {
    chrome.storage.local.get({ coinCount: 0 }, (items) => {
      const coinCountElement = document.getElementById("coinCount");
      coinCountElement.innerText = `Sumites: ${items.coinCount}`;
    });
  }
});



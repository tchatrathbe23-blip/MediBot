(function() {
  // --------------------------------------------------
  // 🎨 STYLES
  // --------------------------------------------------
  const styles = `
    .medi-chat-bubble {
      position: fixed;
      bottom: 25px;
      right: 25px;
      width: 60px;
      height: 60px;
      background: #a855f7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 9999;
      transition: all 0.3s;
    }
    .medi-chat-bubble:hover { transform: scale(1.1); background: #9333ea; }

    .medi-chat-window {
      position: fixed;
      bottom: 100px;
      right: 25px;
      width: 350px;
      height: 450px;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 1rem;
      display: none;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      z-index: 9999;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
    }

    .medi-chat-header {
      padding: 1rem;
      background: #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
    }

    .medi-chat-messages {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      background: #020617;
    }

    .msg {
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      max-width: 85%;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    .msg-bot { background: #1e293b; color: #f1f5f9; align-self: flex-start; }
    .msg-user { background: #a855f7; color: white; align-self: flex-end; }

    .medi-chat-input {
      padding: 1rem;
      background: #1e293b;
      display: flex;
      gap: 0.5rem;
    }
    .medi-chat-input input {
      flex: 1;
      background: #0f172a;
      border: 1px solid #334155;
      color: white;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      outline: none;
    }
    .medi-chat-input button {
      background: #a855f7;
      border: none;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
    }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  // --------------------------------------------------
  // 🏗️ HTML STRUCTURE
  // --------------------------------------------------
  const container = document.createElement("div");
  container.innerHTML = `
    <div id="mediBubble" class="medi-chat-bubble">
      <i class="ph ph-robot"></i>
    </div>
    <div id="mediWindow" class="medi-chat-window">
      <div class="medi-chat-header">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <i class="ph ph-sparkle" style="color:#a855f7"></i>
          <span style="font-weight:600; font-size:0.9rem;">Medi-Assistant</span>
        </div>
        <i class="ph ph-x" style="cursor:pointer" id="closeMediChat"></i>
      </div>
      <div class="medi-chat-messages" id="mediMsgs">
        <div class="msg msg-bot">Hello! I'm your MediBot assistant. How can I help you today?</div>
      </div>
      <div class="medi-chat-input">
        <input type="text" id="mediInput" placeholder="Ask me anything...">
        <button id="mediSend" type="button"><i class="ph ph-paper-plane-right"></i></button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // --------------------------------------------------
  // ⚙️ LOGIC
  // --------------------------------------------------
  const bubble = document.getElementById("mediBubble");
  const chatWindow = document.getElementById("mediWindow");
  const closeBtn = document.getElementById("closeMediChat");
  const sendBtn = document.getElementById("mediSend");
  const input = document.getElementById("mediInput");
  const msgs = document.getElementById("mediMsgs");

  bubble.addEventListener("click", () => {
    chatWindow.style.display = chatWindow.style.display === "flex" ? "none" : "flex";
    if (chatWindow.style.display === "flex") input.focus();
  });

  closeBtn.addEventListener("click", () => chatWindow.style.display = "none");

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    // Add user message
    const userDiv = document.createElement("div");
    userDiv.className = "msg msg-user";
    userDiv.innerText = text;
    msgs.appendChild(userDiv);
    input.value = "";
    msgs.scrollTop = msgs.scrollHeight;

    console.log("MediBot: Sending message:", text);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token 
        },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      
      const botDiv = document.createElement("div");
      botDiv.className = "msg msg-bot";
      botDiv.innerText = data.reply || "I'm busy right now, try again!";
      msgs.appendChild(botDiv);
      msgs.scrollTop = msgs.scrollHeight;
      console.log("MediBot: Assistant replied.");
    } catch (err) {
      console.error("Assistant Error:", err);
    }
  }

  sendBtn.addEventListener("click", (e) => {
    e.preventDefault();
    sendMessage();
  });
  
  input.addEventListener("keypress", (e) => { 
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

})();

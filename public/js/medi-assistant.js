(function() {
  const styles = `
    .medi-chat-bubble {
      position: fixed;
      bottom: 25px;
      right: 25px;
      width: 60px;
      height: 60px;
      background: #3b82f6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
      z-index: 9999;
      transition: all 0.3s;
    }
    .medi-chat-bubble:hover { transform: scale(1.05); background: #2563eb; }

    .medi-chat-window {
      position: fixed;
      bottom: 100px;
      right: 25px;
      width: 380px;
      height: 500px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1.25rem;
      display: none;
      flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      z-index: 9999;
      overflow: hidden;
      font-family: 'Inter', sans-serif;
    }

    .medi-chat-header {
      padding: 1.25rem;
      background: #ffffff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
    }

    .medi-chat-messages {
      flex: 1;
      padding: 1.25rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #f8fafc;
    }

    .msg {
      padding: 0.75rem 1rem;
      border-radius: 1rem;
      max-width: 85%;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .msg-bot { background: #ffffff; color: #1e293b; align-self: flex-start; border: 1px solid #e2e8f0; }
    .msg-user { background: #3b82f6; color: white; align-self: flex-end; }

    .medi-chat-input {
      padding: 1rem;
      background: #ffffff;
      display: flex;
      gap: 0.5rem;
      border-top: 1px solid #f1f5f9;
    }
    .medi-chat-input input {
      flex: 1;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      outline: none;
    }
    .medi-chat-input button {
      background: #3b82f6;
      border: none;
      color: white;
      width: 45px;
      height: 45px;
      border-radius: 0.75rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .typing-indicator { font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.5rem; display: none; }
  `;

  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);

  const container = document.createElement("div");
  container.innerHTML = `
    <div id="mediBubble" class="medi-chat-bubble">
      <i class="ph ph-sparkle"></i>
    </div>
    <div id="mediWindow" class="medi-chat-window">
      <div class="medi-chat-header">
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <div style="width:10px; height:10px; border-radius:50%; background:#22c55e;"></div>
          <span style="font-weight:700; font-size:1rem; color:#1e293b;">Medi-Assistant</span>
        </div>
        <i class="ph ph-x" style="cursor:pointer; font-size:1.2rem; color:#94a3b8;" id="closeMediChat"></i>
      </div>
      <div class="medi-chat-messages" id="mediMsgs">
        <div class="msg msg-bot">Hello! I'm your professional medical companion. How can I assist you with your health records today?</div>
        <div id="typingIndicator" class="typing-indicator">Assistant is thinking...</div>
      </div>
      <div class="medi-chat-input">
        <input type="text" id="mediInput" placeholder="Ask about your reports...">
        <button id="mediSend" type="button"><i class="ph ph-paper-plane-right"></i></button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  const bubble = document.getElementById("mediBubble");
  const chatWindow = document.getElementById("mediWindow");
  const closeBtn = document.getElementById("closeMediChat");
  const sendBtn = document.getElementById("mediSend");
  const input = document.getElementById("mediInput");
  const msgs = document.getElementById("mediMsgs");
  const typing = document.getElementById("typingIndicator");

  bubble.addEventListener("click", () => {
    chatWindow.style.display = chatWindow.style.display === "flex" ? "none" : "flex";
    if (chatWindow.style.display === "flex") input.focus();
  });

  closeBtn.addEventListener("click", () => chatWindow.style.display = "none");

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    const userDiv = document.createElement("div");
    userDiv.className = "msg msg-user";
    userDiv.innerText = text;
    msgs.insertBefore(userDiv, typing);
    input.value = "";
    typing.style.display = "block";
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": token },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      typing.style.display = "none";
      
      const botDiv = document.createElement("div");
      botDiv.className = "msg msg-bot";
      botDiv.innerText = data.reply || "I'm currently optimizing my responses. Please hold on.";
      msgs.insertBefore(botDiv, typing);
      msgs.scrollTop = msgs.scrollHeight;
    } catch (err) {
      typing.style.display = "none";
      const botDiv = document.createElement("div");
      botDiv.className = "msg msg-bot";
      botDiv.innerText = "Connection lost. Please try again.";
      msgs.insertBefore(botDiv, typing);
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

})();

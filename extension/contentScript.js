function extractEmailBody() {
  const emailElement = document.querySelector('.a3s');

  if (emailElement) {
    let emailBody = emailElement.innerText;
    const word_count = emailBody.split(/\s+/).length;
    let emailPrompt =  "You are an expert email summarizer. Read the email carefully and respond following these exact rules:" +
      "1. Ignore greetings, sign-offs, signatures, and 'from' fields. Only focus on the main message content." +
      "2. The email length is " + word_count + " words. Write a summary that strictly follows this format:" +
      "   - If email length is under 50 then write a ONE sentence summary totaling 10-20 words MAX." +
      "   - If email length is 50-100 then write a ONE sentence summary totaling 15-30 words MAX." +
      "   - If email length is 100-200 then write TWO sentences summary totaling 30-55 words MAX." +
      "   - If email length is 200-500 then write TWO or THREE sentences summary totaling 45-60 words MAX."  +
      "   - If email length is over 500 then write THREE sentences summary totaling 50-75 words MAX."  +
      "3. After the summary, print a blank line then IF there are actionable items in the email then list 1-3 brief and specific action items (≤ 15 words each)."  +
      "   - ALWAYS use bullet points for action items." +
      "   - INCLUDE the dates, times, names and details needed to complete each action item." +
      "   - If there are no action items, write exactly: 'No action items needed.' NOTHING MORE OR LESS." +
      "4. Your entire response must be plain text." +
      "   - NO titles, NO headings, NO labels (like 'Subject:' or 'Key Points:')."  +
      "   - NO restating of the prompt."  +
      "   - NO text after the action items — end your response immediately after them." +
      "   - NO INTRODUCTIONS, NO CONCLUSIONS, NO APOLOGIES."  +
      "   - NO use of bullet points or lists in the summary, ONLY in action items." +
      "   - DO NOT have any subject line at the top or any where in your response"  +
      "   - DO NOT use any special characters or emojis." +
      "   - DO NOT fabricate any information — if uncertain, omit it entirely." +
      "   - WHEN possible, include dates, times, names, and details ONLY if they are **explicitly written verbatim in the email text.**" +
      "   - NEVER infer, guess, or assume dates, times, or deadlines. If the date/time is not explicitly present, do not mention it." +
      "   - DO NOT say anything like 'Here is the summary' or 'The action items are'. ONLY provide the summary and action items." +
      "Respond ONLY with the summary and action items (if needed), nothing else. Do not copy any part of the original email word-for-word except essential facts."  +
      "I am directly inserting your response into the email body so ensure that there is no title or extra text anywhere."  +
      "I will now provide you with some ideal action item examples to learn from. DO NOT REPEAT THESE EXAMPLES IN YOUR RESPONSE." +
      "Example 1: Reply to confirm meeting time tomorrow at 3 PM" +
      "Example 2: Add charity event on the January 14th to calendar"  +
      "Example 3: Forward to <manager_name_here> for review"  +
      "Example 4: Prepare financial analysis of company XYZ slides before Friday" +
      "Example 5: Update LLM project status in tracker" +
      "Example 6: Submit quiz wireframes assignment before midnight today" +
      "Example 7: Review attached notes" +
      "Example 8: Sign up for study group" +
      "Example 9: Schedule follow-up call with Boston well digging client" +
      "Example 10: Prepare for upcoming art history presentation" +
      "Finally your email should NOT be an email format in itself. It should be a plain text summary and action items only." +
      "There should be no greetings, no sign-offs, no 'from' fields, no titles, no extra text, and no repetition of the original email." +
      "ONLY LIST THE SUMMARY AND ACTION ITEMS AS DIRECTED." +
      "Analyze the following email and provide your output:";

    const subjectElement = document.querySelector('h2.hP');
    const subject = subjectElement ? subjectElement.innerText : 'Subject not found';

    const senderElement = document.querySelector('.gD');
    const sender = senderElement ? senderElement.getAttribute('email') : 'Sender not found';

    const emailBodyLength = emailBody.length;
    console.log(`✉️ Email Length: ${emailBodyLength} characters`);
    
    generateEmailHash(sender, subject, emailBodyLength).then(emailHash => {
    checkEmailHash(emailHash, (alreadyChecked) => {
    if (alreadyChecked) {
      emailBody = "";
      console.warn("⚠️ This email has already been checked.");
      const cautionElements = document.createElement("div");
      cautionElements.style.color = "red";
      cautionElements.style.fontWeight = "bold";
      cautionElements.style.marginBottom = "5px";
      cautionElements.style.fontSize = "14px";
      cautionElements.innerText = "⚠️ This email has already been checked";
      emailElement.prepend(cautionElements);
      return;
    }
    console.log("✅ Email is new, proceeding with check");

    console.log("📧 Extracted Email Body:\n", emailBody);

    if (!emailBody) {
      console.log("⚠️ No email body found to check");
      console.log("test", document.querySelector('.a3s'));
      return;
    }

    chrome.runtime.sendMessage(
      { type: "CHECK_EMAIL", content: emailBody, prompt: emailPrompt },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Runtime error:", chrome.runtime.lastError.message);
        } else {
          console.log("📨 Background Responded " + response.data.result);

          if (isMaliciousEmail(emailBody)) {
            emailBody = "";
            console.warn("⚠️ Malicious content detected in email body");
            const cautionElements = document.createElement("div");
            cautionElements.style.color = "red";
            cautionElements.style.fontWeight = "bold";
            cautionElements.style.marginBottom = "5px";
            cautionElements.style.fontSize = "14px";
            cautionElements.innerText = "Malicious content detected in response. API may be compromised. Please contact developer at grantklein528@gmail.com";
            emailElement.prepend(cautionElements);
            return;
          }
          else if (response.data.errors === "Internal API server error. Please try again later.") {
            const cautionElements = document.createElement("div");
            cautionElements.style.color = "red";
            cautionElements.style.fontWeight = "bold";
            cautionElements.style.marginBottom = "5px";
            cautionElements.style.fontSize = "14px";
            cautionElements.innerText = "Internal API server error. Please try again later.";
            emailElement.prepend(cautionElements);
          } else if (response.data.errors === "API rate limit exceeded. Please wait 24 hours before trying again") {
            const cautionElements = document.createElement("div");
            cautionElements.style.color = "red";
            cautionElements.style.fontWeight = "bold";
            cautionElements.style.marginBottom = "5px";
            cautionElements.style.fontSize = "14px";
            cautionElements.innerText = "API rate limit exceeded. Please wait 24 hours before trying again";
            emailElement.prepend(cautionElements);
          }

          const resultElement = document.createElement("div");
          resultElement.style.color = "black";
          resultElement.style.fontWeight = "bold";
          resultElement.style.marginBottom = "5px";
          resultElement.style.fontSize = "16px";
          resultElement.innerText = `${response.data.result}`;

          emailElement.prepend(resultElement);
          console.log("✅ Result injected at the top of email body");

          if (response.data.errors == "") {
            chrome.storage.local.get({ coinCount: 0 }, (items) => {
              if (items.coinCount < 99) {
                 items.coinCount += 1;
              }
              chrome.storage.local.set({ coinCount: items.coinCount }, () => {
                console.log(`✅ Coin count updated: ${items.coinCount}`);
                chrome.runtime.sendMessage({ type: "COIN_COUNT_UPDATED" });
              });
            });
          }
        }
      }
    );
  });
}); 
}
}

function checkEmailHash(emailHash, callback) {
  chrome.runtime.sendMessage(
    { type: "CHECK_EMAIL_HASH", emailHash },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Runtime error:", chrome.runtime.lastError.message);
        callback(false); 
      } else {
        callback(response.alreadyChecked);
      }
    }
  );
}

function generateEmailHash(sender, subject, emailBodyLength) {
  const senderWordCount = sender.split(/\s+/).length;
  const subjectWordCount = subject.split(/\s+/).length;

  const hashInput = `${emailBodyLength}-${senderWordCount}-${subjectWordCount}`;

  // Generate a SHA-256 hash
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashInput))
    .then(hashBuffer => {
      // Convert hash buffer to a hex string
      return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
    });
}

function isMaliciousEmail(emailBody) {
  const patterns = [
  /<script.*?>.*?<\/script>/gi,         // Script tags
  /javascript:/gi,                      // JS protocol
  /on\w+\s*=/gi,                        // Event handlers like onload, onclick
  /<iframe.*?>.*?<\/iframe>/gi,         // Iframes
  /<img.*?src=.*?>/gi,                  // Suspicious images
  /eval\(/gi,                           // JS eval
  /document\.cookie/gi,                 // Cookie access
  /window\.location/gi,                 // Redirection
  /style\s*=\s*['"]?expression\(/gi     // CSS expressions
  ];

  return patterns.some(pattern => pattern.test(emailBody));
}

extractEmailBody();

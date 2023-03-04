import {Component, ElementRef, ViewChild} from '@angular/core';
import {Configuration, Model, OpenAIApi} from "openai";
import {TipModalComponent} from "./tip-modal/tip-modal.component";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  messageInput = '';
  messages: { content: string; timestamp: Date; avatar: string; isUser: boolean; }[] = [];
  chatbotTyping = false;
  apikey = '';
  chatHistory = [];
  usedTokens: number = 0;
  darkModeEnabled = false;
  showPassword: boolean = false;

  selectedModel: string = 'text-davinci-003';
  models: Model[] = [];

  @ViewChild('messageContainer', { static: false }) messageContainer: ElementRef;

  @ViewChild('tipModal') tipModal: TipModalComponent;
  showModal: boolean = false;

  constructor() {
    // Retrieve the API key from local storage, if it exists
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
      this.apikey = savedApiKey;
    }

    this.refreshModels();
  }

  async sendMessage() {
    this.chatHistory.push(this.messageInput);
    const openai = this.getOpenAi();
    // Store the API key in local storage
    localStorage.setItem('apiKey', this.apikey);

    // Add the user's message to the chat
    this.messages.push({
      content: this.messageInput,
      timestamp: new Date(),
      avatar: '<i class="bi bi-person-circle"></i>',
      isUser: true
    });

    // Clear the message input field
    this.messageInput = '';

    // Set the chatbot typing indicator to true
    this.chatbotTyping = true;

    setTimeout(() => {
      this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
    }, 0);

    // Generate a response from the chatbot
    const response = await openai.createCompletion({
      model: this.selectedModel,
      prompt: this.chatHistory.join('\n') + '\n' + this.messages[this.messages.length - 1].content,
      temperature: 0,
      max_tokens: 1000,
    });

    // Add the chatbot's response to the chat
    if (response && response.data && response.data.choices && response.data.choices.length > 0) {
      let message = response.data.choices[0].text;
      this.chatHistory.push(message);
      message = this.convertToList(message);
      message = this.asciiToHtmlTable(message);
      this.messages.push({
        content: message,
        timestamp: new Date(),
        avatar: '<i class="bi bi-laptop"></i>',
        isUser: false,
      });
    }

    // Set the chatbot typing indicator to false
    this.chatbotTyping = false;

    setTimeout(() => {
      this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
    }, 0);
  }

  private getOpenAi() {
    const configuration = new Configuration({
      apiKey: this.apikey,
    });
    return new OpenAIApi(configuration);
  }

  async resendLastMessage() {
    // Check if there is a message to resend
    if (this.chatHistory.length > 0) {
      // Get the last message from the chat history
      this.messageInput = this.chatHistory[this.chatHistory.length - 2];
      await this.sendMessage();
    }
  }

  refreshModels() {
    const openai = this.getOpenAi();
    openai.listModels().then(response => {
      this.models = response.data.data;
    })
  }

  convertToList(message) {
    const regex = /(\n([*-]|\d+\.)\s[^\n]+)/g;
    return message.replace(regex, match => {
      const listItem = match.replace(/^\n/, '').replace(/^([*-]|\d+\.)\s/, '');
      return `<li>${listItem}</li>`;
    });
  }

  asciiToHtmlTable(str: string) {
    if(!str.includes('|')) {
      return str;
    }
    const rows = str.split('\n');
    const headers = rows[0].split('|');
    const tableBody = rows.slice(2).map(row => {
      const cells = row.split('|');
      return `<tr>${cells.map(cell => `<td>${cell.trim()}</td>`).join('')}</tr>`;
    }).join('');

    return `<table><thead><tr>${headers.map(header => `<th>${header.trim()}</th>`).join('')}</tr></thead><tbody>${tableBody}</tbody></table>`;
  }

  toggleDarkMode() {
    this.darkModeEnabled = !this.darkModeEnabled;
    const container = document.getElementsByClassName('chat-container')[0];
    if (this.darkModeEnabled) {
      container.classList.add('dark-mode');
    } else {
      container.classList.remove('dark-mode');
    }
  }
}

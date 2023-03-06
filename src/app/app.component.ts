import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {ChatCompletionRequestMessageRoleEnum, Configuration, Model, OpenAIApi} from "openai";
import {TipModalComponent} from "./tip-modal/tip-modal.component";
import {ChatCompletionRequestMessage} from "openai/dist/api";
import * as hljs from 'highlight.js';
import showdown from 'showdown';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  messageInput = '';
  messages: { content: string; contentRaw: string; isRaw?: boolean; timestamp: Date; avatar: string; isUser: boolean; }[] = [];
  chatbotTyping = false;
  apikey = '';
  chatHistory: Array<ChatCompletionRequestMessage> = [];
  usedTokens: number = 0;
  darkModeEnabled = false;
  showPassword: boolean = false;

  selectedModel: string = 'gpt-3.5-turbo';
  models: Model[] = [];

  @ViewChild('messageContainer', {static: false}) messageContainer: ElementRef;

  @ViewChild('tipModal') tipModal: TipModalComponent;
  showTipModal: boolean = false;
  showInfoModal: boolean = false;
  temperature: number = 0.8;

  converter = new showdown.Converter({
    tables: true, emoji: true, underline: true, openLinksInNewWindow: true, tasklists: true,
    strikethrough: true, simplifiedAutoLink: true
  });

  isChatHeaderCollapsed = false;

  constructor() {
    // Retrieve the API key from local storage, if it exists
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
      this.apikey = savedApiKey;
    }
    const savedTemperature = localStorage.getItem('temperature');
    if (savedTemperature) {
      this.temperature = parseFloat(savedTemperature);
    }
    const savedSelectedModel = localStorage.getItem('selectedModel');
    if (savedSelectedModel) {
      this.selectedModel = savedSelectedModel;
    }
    const savedIsChatHeaderCollapsed = localStorage.getItem('isChatHeaderCollapsed');
    if (savedIsChatHeaderCollapsed) {
      this.isChatHeaderCollapsed = JSON.parse(savedIsChatHeaderCollapsed);
    }

    window.addEventListener('beforeunload', () => {
      localStorage.setItem('isChatHeaderCollapsed', JSON.stringify(this.isChatHeaderCollapsed));
    });

    this.refreshModels();
  }

  ngOnInit(): void {
    if (this.isChatHeaderCollapsed) {
      const chatHeader = document.getElementsByClassName('chat-header')[0];
      chatHeader.classList.toggle('collapsed');
    }
  }

  async sendMessage() {
    this.chatHistory.push({content: this.messageInput, role: ChatCompletionRequestMessageRoleEnum.User});
    const openai = this.getOpenAi();

    localStorage.setItem('apiKey', this.apikey);
    localStorage.setItem('temperature', this.temperature.toString());
    localStorage.setItem('selectedModel', this.selectedModel);

    // Add the user's message to the chat
    this.messages.push({
      content: this.messageInput,
      contentRaw: this.messageInput,
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

    let promise;
    promise = openai.createChatCompletion({
      model: this.selectedModel,
      messages: this.chatHistory,
      temperature: this.temperature,
      max_tokens: 1000,
    }).then(response => {
      return response;
    })
      .catch((firstError) => {
        return openai.createCompletion({
          model: this.selectedModel,
          prompt: this.messages[this.messages.length - 1].content,
          temperature: this.temperature,
          max_tokens: 1000,
        })
          .then(response => {
            return response;
          })
          .catch(error => {
            if (firstError.response && firstError.response.status !== 404) {
              throw firstError;
            } else {
              throw error;
            }
          });
      });

    promise.then(response => {
      // Add the chatbot's response to the chat
      if (response && response.data && response.data.choices && response.data.choices.length > 0) {
        let message = '';
        if (response.data.choices[0].message) {
          message = response.data.choices[0].message.content;
        } else {
          // @ts-ignore
          message = response.data.choices[0].text;
        }
        let messageRaw = message;
        this.chatHistory.push({content: messageRaw, role: ChatCompletionRequestMessageRoleEnum.Assistant});
        this.messages.push({
          content: this.converter.makeHtml(message),
          contentRaw: messageRaw,
          timestamp: new Date(),
          avatar: '<i class="bi bi-laptop"></i>',
          isUser: false,
        });
      }
      this.highlightCode();

      // Set the chatbot typing indicator to false
      this.chatbotTyping = false;

      setTimeout(() => {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }, 0);
    }).catch(error => {
      // Set the chatbot typing indicator to false
      this.chatbotTyping = false;

      setTimeout(() => {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }, 0);

      if (error.response && error.response.data && error.response.data.error) {
        alert(error.response.data.error.message);
      } else {
        alert(error.message);
      }
    });

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
      this.messageInput = this.chatHistory[this.chatHistory.length - 2].content;
      await this.sendMessage();
    }
  }

  refreshModels() {
    const openai = this.getOpenAi();
    openai.listModels().then(response => {
      this.models = response.data.data;
    })
  }

  private highlightCode() {
    setTimeout(() => {
      hljs.default.highlightAll();
    }, 50);

  }

  toggleChatHeader() {
    const chatHeader = document.getElementsByClassName('chat-header')[0];
    chatHeader.classList.toggle('collapsed');
    this.isChatHeaderCollapsed = !this.isChatHeaderCollapsed;
    localStorage.setItem('isChatHeaderCollapsed', JSON.stringify(this.isChatHeaderCollapsed));
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

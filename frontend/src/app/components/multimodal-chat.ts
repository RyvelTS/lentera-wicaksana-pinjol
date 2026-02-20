import { Component, OnInit, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiClient } from '../services/ai-client';
import { MarkdownPipe } from '../pipes/markdown.pipe';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  file?: {
    name: string;
    type: string;
    size?: number;
    url?: string;
  };
}

@Component({
  selector: 'app-multimodal-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .markdown-content ul {
        list-style-type: disc;
        margin-left: 1.5rem;
        margin-bottom: 0.5rem;
      }
      .markdown-content ol {
        list-style-type: decimal;
        margin-left: 1.5rem;
        margin-bottom: 0.5rem;
      }
      .markdown-content p {
        margin-bottom: 0.5rem;
      }
      .markdown-content strong {
        font-weight: 700;
      }
      .markdown-content code {
        background-color: rgba(0, 0, 0, 0.1);
        padding: 0.1rem 0.3rem;
        rounded: 0.2rem;
        font-family: monospace;
      }
      .markdown-content pre {
        background-color: #f3f4f6;
        padding: 0.5rem;
        border-radius: 0.375rem;
        overflow-x: auto;
      }
    `,
  ],
  template: `
    <div class="bg-white rounded-xl shadow-lg p-6 max-w-4xl mx-auto">
      <h2 class="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>💬</span>
        Obrolan Multimodal dengan AI Keuangan
      </h2>

      <!-- Chat History -->
      <div
        class="bg-gray-50 rounded-lg p-4 mb-6 min-h-200 max-h-screen overflow-y-auto border border-gray-200 space-y-4"
      >
        @if (conversationHistory().length === 0) {
          <div class="flex items-center justify-center h-full text-center text-gray-400">
            <div>
              <p class="text-4xl mb-2">💭</p>
              <p>Mulai percakapan dengan mengirim pesan</p>
            </div>
          </div>
        } @else {
          @for (msg of conversationHistory(); track $index) {
            <div [class]="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
              <div
                [class]="
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-lg px-4 py-3 max-w-xs md:max-w-md'
                    : 'bg-gray-200 text-gray-800 rounded-lg px-4 py-3 max-w-xl'
                "
              >
                <!-- Display Image if available -->
                @if (msg.file && msg.file.type.startsWith('image') && msg.file.url) {
                  <div class="mb-2">
                    <img
                      [src]="msg.file.url"
                      alt="Uploaded image"
                      class="rounded-lg max-h-48 w-auto object-cover border border-white/20"
                    />
                  </div>
                }

                <!-- Content with Markdown -->
                <div class="text-sm markdown-content" [innerHTML]="msg.content | markdown"></div>

                <!-- File info footer -->
                @if (msg.file) {
                  <div
                    class="flex items-center gap-1 mt-2 pt-2 border-t border-white/20 opacity-80"
                  >
                    <span class="text-xs">
                      @if (msg.file.type.startsWith('image')) {
                        🖼️
                      } @else if (msg.file.type === 'application/pdf') {
                        📄
                      } @else {
                        📎
                      }
                    </span>
                    <span class="text-xs">{{ msg.file.name }}</span>
                  </div>
                }
              </div>
            </div>
          }
        }

        <!-- Loading Indicator -->
        @if (isLoading()) {
          <div class="flex justify-start">
            <div class="bg-gray-200 text-gray-800 rounded-lg px-4 py-3 max-w-xl">
              <p class="text-sm flex items-center gap-2">
                <span class="inline-block animate-bounce">●</span>
                <span class="inline-block animate-bounce" style="animation-delay: 0.1s">●</span>
                <span class="inline-block animate-bounce" style="animation-delay: 0.2s">●</span>
              </p>
            </div>
          </div>
        }
      </div>

      <!-- Message Input Area -->
      <div class="space-y-4">
        <!-- File Preview -->
        @if (selectedFile()) {
          <div
            class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
          >
            <div class="flex items-center gap-3">
              @if (selectedFile()!.type.startsWith('image') && selectedFilePreview()) {
                <img
                  [src]="selectedFilePreview()"
                  class="h-10 w-10 object-cover rounded bg-gray-200"
                />
              } @else {
                <span class="text-xl">
                  @if (selectedFile()!.type === 'application/pdf') {
                    📄
                  } @else if (selectedFile()!.type.startsWith('audio')) {
                    🎵
                  } @else {
                    📎
                  }
                </span>
              }

              <div>
                <p class="text-sm font-medium text-gray-800">{{ selectedFile()!.name }}</p>
                <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile()!.size) }}</p>
              </div>
            </div>
            <button
              (click)="clearFile()"
              class="text-red-500 hover:text-red-700 font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        }

        <!-- Input Controls -->
        <div class="flex gap-2">
          <input
            type="text"
            [(ngModel)]="messageInput"
            (keydown.enter)="sendMessage()"
            placeholder="Ketik pesan..."
            [disabled]="isLoading()"
            class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            (click)="triggerFileInput()"
            [disabled]="isLoading()"
            class="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed font-medium"
          >
            📎
          </button>
          <button
            (click)="sendMessage()"
            [disabled]="(!messageInput().trim() && !selectedFile()) || isLoading()"
            class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold flex items-center gap-2"
          >
            @if (isLoading()) {
              ⏳
            } @else {
              ➤
            }
          </button>
        </div>

        @if (errorMessage()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-red-700 text-sm">
              <span class="font-bold">❌ Error:</span> {{ errorMessage() }}
            </p>
          </div>
        }

        <input
          type="file"
          #fileInput
          (change)="onFileSelected($event)"
          accept="image/*,.pdf,.txt,audio/*"
          class="hidden"
        />
        <p class="text-xs text-gray-500 text-center">Didukung: Gambar, PDF, Audio • Maks 10MB</p>
      </div>
    </div>
  `,
})
export class MultimodalChatComponent implements OnInit {
  private aiClient = inject(AiClient);

  conversationHistory = signal<ChatMessage[]>([]);
  messageInput = signal('');
  isLoading = signal(false);
  errorMessage = signal('');
  selectedFile = signal<File | null>(null);
  selectedFilePreview = signal<string | null>(null);

  ngOnInit() {
    console.log('Multimodal Chat Component initialized');
  }

  triggerFileInput() {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        this.errorMessage.set('❌ File terlalu besar (maks 10MB)');
        return;
      }
      this.selectedFile.set(file);
      this.errorMessage.set('');
      if (file.type.startsWith('image')) {
        const reader = new FileReader();
        reader.onload = (e) => this.selectedFilePreview.set(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        this.selectedFilePreview.set(null);
      }
    }
  }

  clearFile() {
    this.selectedFile.set(null);
    this.selectedFilePreview.set(null);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) input.value = '';
  }

  sendMessage() {
    const message = this.messageInput().trim();
    if (!message && !this.selectedFile()) return;
    const fileData = this.selectedFile();
    const previewData = this.selectedFilePreview();

    const userMessage: ChatMessage = { role: 'user', content: message };
    if (fileData) {
      userMessage.file = {
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        url: previewData || undefined,
      };
    }

    this.conversationHistory.update((hist) => [...hist, userMessage]);
    this.messageInput.set('');
    this.clearFile();
    this.isLoading.set(true);
    this.errorMessage.set('');

    const historyForApi = this.conversationHistory()
      .slice(0, -1)
      .map((msg) => ({ role: msg.role, content: msg.content }));

    this.aiClient.multimodalChat(message, fileData || undefined, historyForApi, 0.3).subscribe({
      next: (response) => {
        this.conversationHistory.update((hist) => [
          ...hist,
          { role: 'assistant', content: response.result },
        ]);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(error.message || 'Gagal mengirim pesan');
      },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

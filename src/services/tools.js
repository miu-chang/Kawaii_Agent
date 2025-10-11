// OpenAI Responses API用のツール定義と実行ハンドラー

// ツール定義（Responses APIに渡す - 平坦化された形式）
export const toolDefinitions = [
  {
    type: 'function',
    name: 'get_current_time',
    description: '現在の日時を取得します。今何時か、今日は何日か、何曜日かを知りたい時に使用します。',
    parameters: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['full', 'time', 'date'],
          description: 'フォーマット: full=日時両方, time=時刻のみ, date=日付のみ'
        }
      },
      required: ['format'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'set_timer',
    description: '指定時間後にタイマー通知を設定します。',
    parameters: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: '分数（例: 5分後なら5）'
        },
        message: {
          type: 'string',
          description: 'タイマー終了時のメッセージ'
        }
      },
      required: ['duration', 'message'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'save_memo',
    description: 'メモを保存します。重要な情報を記録したい時に使用します。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'メモのタイトル'
        },
        content: {
          type: 'string',
          description: 'メモの内容'
        }
      },
      required: ['title', 'content'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_memos',
    description: '保存されているメモ一覧を取得します。',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_system_info',
    description: 'システム情報（メモリ使用率、プラットフォーム情報など）を取得します。',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'add_todo',
    description: 'To-Doリストにタスクを追加します。',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'タスクの内容'
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: '優先度（high=高, medium=中, low=低）デフォルトはmedium'
        }
      },
      required: ['task'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_todos',
    description: 'To-Doリストを取得します。',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'active', 'completed'],
          description: 'フィルター（all=全て, active=未完了のみ, completed=完了済みのみ）デフォルトはactive'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'complete_todo',
    description: 'To-Doリストのタスクを完了にします。',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'タスクのID'
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'delete_todo',
    description: 'To-Doリストからタスクを削除します。',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'タスクのID'
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'copy_to_clipboard',
    description: 'テキストをクリップボードにコピーします。',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'コピーするテキスト'
        }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'read_file',
    description: 'ファイルの内容を読み取ります。テキストファイル、JSON、CSVなどに対応。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'ファイルパス（絶対パスまたは相対パス）'
        }
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'write_file',
    description: 'ファイルに内容を書き込みます。レポート生成やデータ保存に使用。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'ファイルパス'
        },
        content: {
          type: 'string',
          description: '書き込む内容'
        }
      },
      required: ['path', 'content'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'list_files',
    description: 'ディレクトリ内のファイル一覧を取得します。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'ディレクトリパス（省略時はホームディレクトリ）'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'open_application',
    description: 'アプリケーションやURLを開きます。',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'アプリ名（chrome, vscode, finderなど）またはURL'
        }
      },
      required: ['target'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_resource_usage',
    description: 'CPUとメモリの使用率をリアルタイムで取得します。',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'add_calendar_event',
    description: 'カレンダーにイベントを追加します。予定やスケジュールの管理に使用。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'イベントのタイトル'
        },
        date: {
          type: 'string',
          description: '日付（YYYY-MM-DD形式、例: 2025-01-15）'
        },
        time: {
          type: 'string',
          description: '時刻（HH:MM形式、例: 14:30）省略可能'
        },
        description: {
          type: 'string',
          description: 'イベントの詳細（省略可能）'
        }
      },
      required: ['title', 'date'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_calendar_events',
    description: 'カレンダーのイベント一覧を取得します。',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: '特定の日付（YYYY-MM-DD形式）、省略時は今日から1週間分'
        },
        range: {
          type: 'string',
          enum: ['day', 'week', 'month'],
          description: '取得範囲（day=その日のみ, week=1週間, month=1ヶ月）デフォルトはweek'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'delete_calendar_event',
    description: 'カレンダーからイベントを削除します。',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'イベントのID'
        }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    type: 'web_search'
  }
];

// ツール実行ハンドラー
export class ToolExecutor {
  constructor() {
    this.timers = new Map();
    this.onTimerComplete = null; // タイマー完了時のコールバック
  }

  // タイマー完了時のコールバックを設定
  setTimerCompleteCallback(callback) {
    this.onTimerComplete = callback;
  }

  // 現在時刻取得
  get_current_time(args) {
    const now = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];

    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const day = days[now.getDay()];
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    if (args.format === 'time') {
      return `${hours}:${minutes}`;
    } else if (args.format === 'date') {
      return `${year}年${month}月${date}日(${day})`;
    } else {
      return `${year}年${month}月${date}日(${day}) ${hours}:${minutes}`;
    }
  }

  // タイマー設定
  set_timer(args) {
    // argsが文字列の場合はパース
    let parsedArgs = args;
    if (typeof args === 'string') {
      parsedArgs = JSON.parse(args);
    }

    const duration = parsedArgs.duration * 60 * 1000; // 分をミリ秒に変換
    const message = parsedArgs.message;
    const timerId = Date.now().toString();

    const timer = setTimeout(() => {
      console.log('[Timer] Timer completed:', message);

      // コールバックが設定されていれば呼び出す
      if (this.onTimerComplete) {
        this.onTimerComplete(message);
      } else {
        // フォールバック: 通知のみ
        if (window.Notification && Notification.permission === 'granted') {
          new Notification('⏰ タイマー終了', {
            body: message
          });
        }
      }

      this.timers.delete(timerId);
    }, duration);

    this.timers.set(timerId, timer);

    return `⏰ ${parsedArgs.duration}分後にタイマーを設定しました！`;
  }

  // メモ保存
  save_memo(args) {
    try {
      const memos = JSON.parse(localStorage.getItem('memos') || '[]');
      const newMemo = {
        id: Date.now(),
        title: args.title,
        content: args.content,
        timestamp: new Date().toISOString()
      };
      memos.push(newMemo);
      localStorage.setItem('memos', JSON.stringify(memos));

      return `メモを保存しました: \"${args.title}\"`;
    } catch (error) {
      return 'メモの保存に失敗しました。';
    }
  }

  // メモ一覧取得
  get_memos() {
    try {
      const memos = JSON.parse(localStorage.getItem('memos') || '[]');
      if (memos.length === 0) {
        return '保存されているメモはありません。';
      }

      const memoList = memos.map(m =>
        `・${m.title} (${new Date(m.timestamp).toLocaleString()})\n  ${m.content}`
      ).join('\n\n');

      return `保存されているメモ:\n\n${memoList}`;
    } catch (error) {
      return 'メモの取得に失敗しました。';
    }
  }

  // システム情報取得
  get_system_info() {
    try {
      const info = {
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        onLine: navigator.onLine ? 'オンライン' : 'オフライン',
        memory: performance.memory ? {
          usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
          totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
          jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
        } : '情報なし',
        cores: navigator.hardwareConcurrency || '不明',
        screenResolution: `${screen.width} x ${screen.height}`,
        colorDepth: `${screen.colorDepth} bit`
      };

      let result = 'システム情報:\n\n';
      result += `プラットフォーム: ${info.platform}\n`;
      result += `言語: ${info.language}\n`;
      result += `接続状態: ${info.onLine}\n`;
      result += `CPUコア数: ${info.cores}\n`;
      result += `画面解像度: ${info.screenResolution}\n`;
      result += `色深度: ${info.colorDepth}\n`;

      if (info.memory !== '情報なし') {
        result += `\nメモリ使用状況:\n`;
        result += `  使用中: ${info.memory.usedJSHeapSize}\n`;
        result += `  合計: ${info.memory.totalJSHeapSize}\n`;
        result += `  上限: ${info.memory.jsHeapSizeLimit}`;
      }

      return result;

    } catch (error) {
      console.error('System info error:', error);
      return 'システム情報の取得に失敗しました。';
    }
  }

  // To-Do追加
  add_todo(args) {
    try {
      const todos = JSON.parse(localStorage.getItem('todos') || '[]');
      const newTodo = {
        id: Date.now(),
        task: args.task,
        priority: args.priority || 'medium',
        completed: false,
        createdAt: new Date().toISOString()
      };
      todos.push(newTodo);
      localStorage.setItem('todos', JSON.stringify(todos));

      const priorityText = { high: '高', medium: '中', low: '低' }[newTodo.priority];
      return `タスクを追加しました: "${args.task}" (優先度: ${priorityText})`;

    } catch (error) {
      console.error('Add todo error:', error);
      return 'タスクの追加に失敗しました。';
    }
  }

  // To-Do一覧取得
  get_todos(args) {
    try {
      const todos = JSON.parse(localStorage.getItem('todos') || '[]');
      const filter = args.filter || 'active';

      let filteredTodos = todos;
      if (filter === 'active') {
        filteredTodos = todos.filter(t => !t.completed);
      } else if (filter === 'completed') {
        filteredTodos = todos.filter(t => t.completed);
      }

      if (filteredTodos.length === 0) {
        if (filter === 'active') return 'タスクはありません。';
        if (filter === 'completed') return '完了済みのタスクはありません。';
        return 'タスクが見つかりませんでした。';
      }

      const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' };
      const todoList = filteredTodos.map(t => {
        const status = t.completed ? '✅' : '⬜';
        const priority = priorityEmoji[t.priority] || '⚪';
        const createdDate = new Date(t.createdAt).toLocaleDateString('ja-JP');
        return `${status} ${priority} [ID:${t.id}] ${t.task}\n   作成日: ${createdDate}`;
      }).join('\n\n');

      return `To-Doリスト:\n\n${todoList}`;

    } catch (error) {
      console.error('Get todos error:', error);
      return 'To-Doリストの取得に失敗しました。';
    }
  }

  // To-Do完了
  complete_todo(args) {
    try {
      const todos = JSON.parse(localStorage.getItem('todos') || '[]');
      const todo = todos.find(t => t.id === args.id);

      if (!todo) {
        return `ID:${args.id}のタスクが見つかりませんでした。`;
      }

      if (todo.completed) {
        return `タスク"${todo.task}"は既に完了しています。`;
      }

      todo.completed = true;
      todo.completedAt = new Date().toISOString();
      localStorage.setItem('todos', JSON.stringify(todos));

      return `タスクを完了しました: "${todo.task}"`;

    } catch (error) {
      console.error('Complete todo error:', error);
      return 'タスクの完了処理に失敗しました。';
    }
  }

  // To-Do削除
  delete_todo(args) {
    try {
      const todos = JSON.parse(localStorage.getItem('todos') || '[]');
      const todoIndex = todos.findIndex(t => t.id === args.id);

      if (todoIndex === -1) {
        return `ID:${args.id}のタスクが見つかりませんでした。`;
      }

      const deletedTodo = todos[todoIndex];
      todos.splice(todoIndex, 1);
      localStorage.setItem('todos', JSON.stringify(todos));

      return `タスクを削除しました: "${deletedTodo.task}"`;

    } catch (error) {
      console.error('Delete todo error:', error);
      return 'タスクの削除に失敗しました。';
    }
  }

  // クリップボードにコピー
  async copy_to_clipboard(args) {
    try {
      await navigator.clipboard.writeText(args.text);
      return `クリップボードにコピーしました: "${args.text.substring(0, 50)}${args.text.length > 50 ? '...' : ''}"`;
    } catch (error) {
      console.error('Clipboard error:', error);
      return 'クリップボードへのコピーに失敗しました。';
    }
  }

  // ファイル読み取り（Electron IPC経由）
  async read_file(args) {
    try {
      if (!window.electronAPI?.readFile) {
        return 'ファイル読み取り機能は利用できません。';
      }
      const result = await window.electronAPI.readFile(args.path);
      if (result.error) {
        return `エラー: ${result.error}`;
      }
      return `ファイル内容:\n\n${result.content}`;
    } catch (error) {
      console.error('Read file error:', error);
      return `ファイルの読み取りに失敗しました: ${error.message}`;
    }
  }

  // ファイル書き込み（Electron IPC経由）
  async write_file(args) {
    try {
      if (!window.electronAPI?.writeFile) {
        return 'ファイル書き込み機能は利用できません。';
      }
      const result = await window.electronAPI.writeFile(args.path, args.content);
      if (result.error) {
        return `エラー: ${result.error}`;
      }
      return `ファイルに書き込みました: ${args.path}`;
    } catch (error) {
      console.error('Write file error:', error);
      return `ファイルの書き込みに失敗しました: ${error.message}`;
    }
  }

  // ファイル一覧取得（Electron IPC経由）
  async list_files(args) {
    try {
      if (!window.electronAPI?.listFiles) {
        return 'ファイル一覧機能は利用できません。';
      }
      const result = await window.electronAPI.listFiles(args.path);
      if (result.error) {
        return `エラー: ${result.error}`;
      }
      const files = result.files.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join('\n');
      return `${result.path}\n\n${files}`;
    } catch (error) {
      console.error('List files error:', error);
      return `ファイル一覧の取得に失敗しました: ${error.message}`;
    }
  }

  // アプリケーション起動（Electron IPC経由）
  async open_application(args) {
    try {
      if (!window.electronAPI?.openApp) {
        return 'アプリ起動機能は利用できません。';
      }
      const result = await window.electronAPI.openApp(args.target);
      if (result.error) {
        return `エラー: ${result.error}`;
      }
      return result.message || `${args.target}を開きました。`;
    } catch (error) {
      console.error('Open app error:', error);
      return `アプリの起動に失敗しました: ${error.message}`;
    }
  }

  // リソース使用率取得
  async get_resource_usage(args) {
    try {
      let result = 'システムリソース使用状況:\n\n';

      // Electronのシステム情報を優先的に表示
      if (window.electronAPI?.getSystemResources) {
        const sysRes = await window.electronAPI.getSystemResources();
        if (!sysRes.error) {
          // プラットフォーム情報
          const platformName = {
            'darwin': 'macOS',
            'win32': 'Windows',
            'linux': 'Linux'
          }[sysRes.platform] || sysRes.platform;

          result += `💻 プラットフォーム: ${platformName} (${sysRes.arch})\n\n`;

          // CPU情報
          result += `🖥️  CPU:\n`;
          result += `  コア数: ${navigator.hardwareConcurrency || 'N/A'}個\n`;
          result += `  使用率: ${sysRes.cpuUsage}%\n\n`;

          // メモリ情報（システム全体）
          const usedMemory = (parseFloat(sysRes.totalMemory) - parseFloat(sysRes.freeMemory)).toFixed(2);
          result += `💾 メモリ（システム全体）:\n`;
          result += `  総容量: ${sysRes.totalMemory} GB\n`;
          result += `  使用中: ${usedMemory} GB (${sysRes.memoryUsage}%)\n`;
          result += `  空き: ${sysRes.freeMemory} GB\n\n`;

          // アプリのメモリ使用量
          if (performance.memory) {
            const appUsedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
            const appLimitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
            const appUsagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);

            result += `📱 このアプリのメモリ:\n`;
            result += `  使用中: ${appUsedMB} MB / ${appLimitMB} MB (${appUsagePercent}%)\n`;
          }
        } else {
          // Electronのシステム情報取得失敗時のフォールバック
          result += `⚠️  詳細なシステム情報の取得に失敗しました。\n\n`;

          if (navigator.hardwareConcurrency) {
            result += `🖥️  CPUコア数: ${navigator.hardwareConcurrency}個\n\n`;
          }

          if (performance.memory) {
            const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
            const limitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
            const usagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);

            result += `💾 アプリのメモリ:\n`;
            result += `  使用中: ${usedMB} MB / ${limitMB} MB (${usagePercent}%)\n`;
          }
        }
      } else {
        // Electron APIが利用できない場合
        result += `⚠️  システム情報機能が利用できません。\n\n`;

        if (navigator.hardwareConcurrency) {
          result += `🖥️  CPUコア数: ${navigator.hardwareConcurrency}個\n\n`;
        }

        if (performance.memory) {
          const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
          const limitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
          const usagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);

          result += `💾 アプリのメモリ:\n`;
          result += `  使用中: ${usedMB} MB / ${limitMB} MB (${usagePercent}%)\n`;
        }
      }

      return result;

    } catch (error) {
      console.error('Resource usage error:', error);
      return 'リソース使用状況の取得に失敗しました。';
    }
  }

  // カレンダーイベント追加
  add_calendar_event(args) {
    try {
      const events = JSON.parse(localStorage.getItem('calendar_events') || '[]');
      const newEvent = {
        id: Date.now(),
        title: args.title,
        date: args.date,
        time: args.time || null,
        description: args.description || '',
        createdAt: new Date().toISOString()
      };
      events.push(newEvent);
      events.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time || '00:00'}`);
        const dateB = new Date(`${b.date} ${b.time || '00:00'}`);
        return dateA - dateB;
      });
      localStorage.setItem('calendar_events', JSON.stringify(events));

      const timeStr = args.time ? ` ${args.time}` : '';
      return `📅 イベントを追加しました:\n"${args.title}"\n日時: ${args.date}${timeStr}`;

    } catch (error) {
      console.error('Add calendar event error:', error);
      return 'イベントの追加に失敗しました。';
    }
  }

  // カレンダーイベント取得
  get_calendar_events(args) {
    try {
      const events = JSON.parse(localStorage.getItem('calendar_events') || '[]');
      if (events.length === 0) {
        return '予定はありません。';
      }

      const range = args.range || 'week';
      const baseDate = args.date ? new Date(args.date) : new Date();
      baseDate.setHours(0, 0, 0, 0);

      let endDate = new Date(baseDate);
      if (range === 'day') {
        endDate.setDate(endDate.getDate() + 1);
      } else if (range === 'week') {
        endDate.setDate(endDate.getDate() + 7);
      } else if (range === 'month') {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const filteredEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= baseDate && eventDate < endDate;
      });

      if (filteredEvents.length === 0) {
        const rangeText = { day: 'その日', week: '今週', month: '今月' }[range] || '指定期間';
        return `${rangeText}の予定はありません。`;
      }

      const rangeText = { day: 'の予定', week: '（今週）', month: '（今月）' }[range] || '';
      let result = `📅 カレンダー${rangeText}:\n\n`;

      filteredEvents.forEach(event => {
        const eventDate = new Date(event.date);
        const dateStr = eventDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' });
        const timeStr = event.time ? ` ${event.time}` : '';
        result += `[ID:${event.id}] ${dateStr}${timeStr}\n`;
        result += `  ${event.title}\n`;
        if (event.description) {
          result += `  ${event.description}\n`;
        }
        result += '\n';
      });

      return result.trim();

    } catch (error) {
      console.error('Get calendar events error:', error);
      return 'イベントの取得に失敗しました。';
    }
  }

  // カレンダーイベント削除
  delete_calendar_event(args) {
    try {
      const events = JSON.parse(localStorage.getItem('calendar_events') || '[]');
      const eventIndex = events.findIndex(e => e.id === args.id);

      if (eventIndex === -1) {
        return `ID:${args.id}のイベントが見つかりませんでした。`;
      }

      const deletedEvent = events[eventIndex];
      events.splice(eventIndex, 1);
      localStorage.setItem('calendar_events', JSON.stringify(events));

      return `イベントを削除しました: "${deletedEvent.title}" (${deletedEvent.date})`;

    } catch (error) {
      console.error('Delete calendar event error:', error);
      return 'イベントの削除に失敗しました。';
    }
  }

  // ツール実行の統一インターフェース
  async execute(toolName, args) {
    console.log(`[Tool Execute] ${toolName}`, args);

    if (typeof this[toolName] === 'function') {
      const result = await this[toolName](args);
      console.log(`[Tool Result] ${toolName}:`, result);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

// シングルトンインスタンス
export const toolExecutor = new ToolExecutor();

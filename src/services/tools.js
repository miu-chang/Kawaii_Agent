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
    type: 'function',
    name: 'google_calendar_list',
    description: 'Googleカレンダーの予定一覧を取得します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: '取得する日数（今日から何日後まで）デフォルトは7日'
        },
        maxResults: {
          type: 'number',
          description: '最大取得件数。デフォルトは10'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_calendar_create',
    description: 'Googleカレンダーに予定を追加します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '予定のタイトル'
        },
        start: {
          type: 'string',
          description: '開始日時（ISO 8601形式、例: 2025-01-15T14:00:00+09:00）'
        },
        end: {
          type: 'string',
          description: '終了日時（ISO 8601形式、例: 2025-01-15T15:00:00+09:00）'
        },
        description: {
          type: 'string',
          description: '予定の詳細（省略可能）'
        },
        location: {
          type: 'string',
          description: '場所（省略可能）'
        }
      },
      required: ['summary', 'start', 'end'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_calendar_delete',
    description: 'Googleカレンダーから予定を削除します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: '削除する予定のID'
        }
      },
      required: ['eventId'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'gmail_list',
    description: 'Gmailの受信メール一覧を取得します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: '最大取得件数。デフォルトは10'
        },
        unreadOnly: {
          type: 'boolean',
          description: '未読のみ取得する場合はtrue。デフォルトはfalse'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'gmail_send',
    description: 'Gmailでメールを送信します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: '送信先メールアドレス'
        },
        subject: {
          type: 'string',
          description: 'メールの件名'
        },
        body: {
          type: 'string',
          description: 'メール本文'
        }
      },
      required: ['to', 'subject', 'body'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_drive_list',
    description: 'Google Driveのファイル一覧を取得します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'ファイル名で検索（省略可能）'
        },
        maxResults: {
          type: 'number',
          description: '最大取得件数。デフォルトは20'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_drive_search',
    description: 'Google Driveでファイルを検索します（ファイル名＋内容検索）。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索クエリ'
        },
        maxResults: {
          type: 'number',
          description: '最大取得件数。デフォルトは20'
        }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_drive_share',
    description: 'Google Driveのファイルを共有リンクにします。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: '共有するファイルのID'
        }
      },
      required: ['fileId'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_tasks_list',
    description: 'Google Tasksのタスク一覧を取得します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: '最大取得件数。デフォルトは20'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_tasks_create',
    description: 'Google Tasksにタスクを追加します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'タスクのタイトル'
        },
        notes: {
          type: 'string',
          description: 'タスクの詳細（省略可能）'
        },
        due: {
          type: 'string',
          description: '期限（ISO 8601形式、例: 2025-01-15T00:00:00Z）（省略可能）'
        }
      },
      required: ['title'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_tasks_complete',
    description: 'Google Tasksのタスクを完了にします。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '完了するタスクのID'
        }
      },
      required: ['taskId'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_tasks_delete',
    description: 'Google Tasksのタスクを削除します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '削除するタスクのID'
        }
      },
      required: ['taskId'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_contacts_search',
    description: 'Google Contactsで連絡先を検索します。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索クエリ（名前やメールアドレス）'
        },
        maxResults: {
          type: 'number',
          description: '最大取得件数。デフォルトは20'
        }
      },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'google_meet_create',
    description: 'Google Meetの会議リンクを作成します（カレンダー予定として登録）。Google連携が必要です。',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '会議のタイトル'
        },
        start: {
          type: 'string',
          description: '開始日時（ISO 8601形式、例: 2025-01-15T14:00:00+09:00）'
        },
        end: {
          type: 'string',
          description: '終了日時（ISO 8601形式、例: 2025-01-15T15:00:00+09:00）'
        },
        description: {
          type: 'string',
          description: '会議の詳細（省略可能）'
        }
      },
      required: ['summary', 'start', 'end'],
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
          new Notification('[Timer] タイマー終了', {
            body: message
          });
        }
      }

      this.timers.delete(timerId);
    }, duration);

    this.timers.set(timerId, timer);

    return `[Timer] ${parsedArgs.duration}分後にタイマーを設定しました！`;
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

      const priorityIcon = { high: '[!]', medium: '[~]', low: '[.]' };
      const todoList = filteredTodos.map(t => {
        const status = t.completed ? '[x]' : '[ ]';
        const priority = priorityIcon[t.priority] || '[-]';
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
      const files = result.files.map(f => `${f.type === 'dir' ? '[DIR]' : '[FILE]'} ${f.name}`).join('\n');
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

          result += `[Platform] ${platformName} (${sysRes.arch})\n\n`;

          // CPU情報
          result += `[CPU]\n`;
          result += `  コア数: ${navigator.hardwareConcurrency || 'N/A'}個\n`;
          result += `  使用率: ${sysRes.cpuUsage}%\n\n`;

          // メモリ情報（システム全体）
          const usedMemory = (parseFloat(sysRes.totalMemory) - parseFloat(sysRes.freeMemory)).toFixed(2);
          result += `[Memory - System]\n`;
          result += `  総容量: ${sysRes.totalMemory} GB\n`;
          result += `  使用中: ${usedMemory} GB (${sysRes.memoryUsage}%)\n`;
          result += `  空き: ${sysRes.freeMemory} GB\n\n`;

          // アプリのメモリ使用量
          if (performance.memory) {
            const appUsedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
            const appLimitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
            const appUsagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);

            result += `[Memory - App]\n`;
            result += `  使用中: ${appUsedMB} MB / ${appLimitMB} MB (${appUsagePercent}%)\n`;
          }
        } else {
          // Electronのシステム情報取得失敗時のフォールバック
          result += `[!] 詳細なシステム情報の取得に失敗しました。\n\n`;

          if (navigator.hardwareConcurrency) {
            result += `[CPU] コア数: ${navigator.hardwareConcurrency}個\n\n`;
          }

          if (performance.memory) {
            const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
            const limitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
            const usagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);

            result += `[Memory - App]\n`;
            result += `  使用中: ${usedMB} MB / ${limitMB} MB (${usagePercent}%)\n`;
          }
        }
      } else {
        // Electron APIが利用できない場合
        result += `[!] システム情報機能が利用できません。\n\n`;

        if (navigator.hardwareConcurrency) {
          result += `[CPU] コア数: ${navigator.hardwareConcurrency}個\n\n`;
        }

        if (performance.memory) {
          const usedMB = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
          const limitMB = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
          const usagePercent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1);

          result += `[Memory - App]\n`;
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
      return `[Calendar] イベントを追加しました:\n"${args.title}"\n日時: ${args.date}${timeStr}`;

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
      let result = `[Calendar]${rangeText}:\n\n`;

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

  // Google Calendar: 予定一覧取得
  async google_calendar_list(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const days = args.days || 7;
      const maxResults = args.maxResults || 10;

      const timeMin = new Date().toISOString();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + days);

      const events = await googleApiService.getCalendarEvents({
        timeMin,
        timeMax: timeMax.toISOString(),
        maxResults
      });

      if (events.length === 0) {
        return `今後${days}日間の予定はありません。`;
      }

      let result = `[Google Calendar] 今後${days}日間の予定:\n\n`;
      events.forEach(event => {
        const start = event.start.dateTime || event.start.date;
        const startDate = new Date(start);
        const dateStr = startDate.toLocaleString('ja-JP', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
          hour: event.start.dateTime ? 'numeric' : undefined,
          minute: event.start.dateTime ? '2-digit' : undefined
        });

        result += `[ID:${event.id.substring(0, 8)}...] ${dateStr}\n`;
        result += `  ${event.summary}\n`;
        if (event.location) {
          result += `  [Location] ${event.location}\n`;
        }
        result += '\n';
      });

      return result.trim();

    } catch (error) {
      console.error('Google Calendar list error:', error);
      return `Googleカレンダーの取得に失敗しました: ${error.message}`;
    }
  }

  // Google Calendar: 予定追加
  async google_calendar_create(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const eventData = {
        summary: args.summary,
        description: args.description || '',
        location: args.location || '',
        start: {
          dateTime: args.start,
          timeZone: 'Asia/Tokyo'
        },
        end: {
          dateTime: args.end,
          timeZone: 'Asia/Tokyo'
        }
      };

      const event = await googleApiService.createCalendarEvent(eventData);

      const startDate = new Date(args.start);
      const dateStr = startDate.toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      });

      return `[Google Calendar] 予定を追加しました:\n"${args.summary}"\n日時: ${dateStr}`;

    } catch (error) {
      console.error('Google Calendar create error:', error);
      return `Googleカレンダーへの追加に失敗しました: ${error.message}`;
    }
  }

  // Google Calendar: 予定削除
  async google_calendar_delete(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      await googleApiService.deleteCalendarEvent(args.eventId);
      return `Googleカレンダーから予定を削除しました。`;

    } catch (error) {
      console.error('Google Calendar delete error:', error);
      return `Googleカレンダーからの削除に失敗しました: ${error.message}`;
    }
  }

  // Gmail: メール一覧取得
  async gmail_list(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const maxResults = args.maxResults || 10;
      const q = args.unreadOnly ? 'is:unread' : '';

      const messages = await googleApiService.getGmailMessages({
        maxResults,
        q
      });

      if (messages.length === 0) {
        return args.unreadOnly ? '未読メールはありません。' : 'メールがありません。';
      }

      let result = `[Gmail] ${args.unreadOnly ? '(未読のみ)' : ''}:\n\n`;
      messages.forEach(msg => {
        const date = new Date(msg.date);
        const dateStr = date.toLocaleString('ja-JP', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });

        result += `[${dateStr}] ${msg.subject}\n`;
        result += `  From: ${msg.from}\n`;
        result += `  ${msg.snippet}\n\n`;
      });

      return result.trim();

    } catch (error) {
      console.error('Gmail list error:', error);
      return `Gmailの取得に失敗しました: ${error.message}`;
    }
  }

  // Gmail: メール送信
  async gmail_send(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const messageData = {
        to: args.to,
        subject: args.subject,
        body: args.body
      };

      await googleApiService.sendGmailMessage(messageData);
      return `[Gmail] メールを送信しました:\n宛先: ${args.to}\n件名: ${args.subject}`;

    } catch (error) {
      console.error('Gmail send error:', error);
      return `メールの送信に失敗しました: ${error.message}`;
    }
  }

  // Google Drive: ファイル一覧
  async google_drive_list(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const files = await googleApiService.getDriveFiles(args);

      if (files.length === 0) {
        return 'ファイルが見つかりませんでした。';
      }

      let result = `[Google Drive] ファイル一覧:\n\n`;
      files.forEach(file => {
        const sizeStr = file.size ? ` (${(file.size / 1024).toFixed(1)}KB)` : '';
        result += `[File ID: ${file.id}]\n`;
        result += `  ${file.name}${sizeStr}\n`;
        result += `  ${file.webViewLink || ''}\n\n`;
      });

      return result.trim();

    } catch (error) {
      console.error('Google Drive list error:', error);
      return `Google Driveのファイル取得に失敗しました: ${error.message}`;
    }
  }

  // Google Drive: ファイル検索
  async google_drive_search(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const files = await googleApiService.searchDriveFiles(args.query, { maxResults: args.maxResults });

      if (files.length === 0) {
        return `「${args.query}」に一致するファイルが見つかりませんでした。`;
      }

      let result = `[Google Drive] 検索結果: 「${args.query}」\n\n`;
      files.forEach(file => {
        const sizeStr = file.size ? ` (${(file.size / 1024).toFixed(1)}KB)` : '';
        result += `[File ID: ${file.id}]\n`;
        result += `  ${file.name}${sizeStr}\n`;
        result += `  ${file.webViewLink || ''}\n\n`;
      });

      return result.trim();

    } catch (error) {
      console.error('Google Drive search error:', error);
      return `Google Driveの検索に失敗しました: ${error.message}`;
    }
  }

  // Google Drive: ファイル共有
  async google_drive_share(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const result = await googleApiService.shareDriveFile(args.fileId);
      return `[Google Drive] ファイルを共有しました:\n${result.webViewLink}`;

    } catch (error) {
      console.error('Google Drive share error:', error);
      return `Google Driveの共有に失敗しました: ${error.message}`;
    }
  }

  // Google Tasks: タスク一覧
  async google_tasks_list(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const tasks = await googleApiService.getTasks(args);

      if (tasks.length === 0) {
        return 'タスクはありません。';
      }

      let result = `[Google Tasks] タスク一覧:\n\n`;
      tasks.forEach(task => {
        const status = task.status === 'completed' ? '[完了]' : '[ ]';
        result += `${status} ${task.title}\n`;
        result += `  Task ID: ${task.id}\n`;
        if (task.notes) {
          result += `  ${task.notes}\n`;
        }
        if (task.due) {
          const due = new Date(task.due);
          result += `  期限: ${due.toLocaleDateString('ja-JP')}\n`;
        }
        result += '\n';
      });

      return result.trim();

    } catch (error) {
      console.error('Google Tasks list error:', error);
      return `Google Tasksの取得に失敗しました: ${error.message}`;
    }
  }

  // Google Tasks: タスク作成
  async google_tasks_create(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const task = await googleApiService.createTask(args);
      return `[Google Tasks] タスクを追加しました:\n${task.title}`;

    } catch (error) {
      console.error('Google Tasks create error:', error);
      return `タスクの追加に失敗しました: ${error.message}`;
    }
  }

  // Google Tasks: タスク完了
  async google_tasks_complete(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const task = await googleApiService.completeTask(args.taskId);
      return `[Google Tasks] タスクを完了にしました:\n${task.title}`;

    } catch (error) {
      console.error('Google Tasks complete error:', error);
      return `タスクの完了に失敗しました: ${error.message}`;
    }
  }

  // Google Tasks: タスク削除
  async google_tasks_delete(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      await googleApiService.deleteTask(args.taskId);
      return `[Google Tasks] タスクを削除しました。`;

    } catch (error) {
      console.error('Google Tasks delete error:', error);
      return `タスクの削除に失敗しました: ${error.message}`;
    }
  }

  // Google Contacts: 連絡先検索
  async google_contacts_search(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const contacts = await googleApiService.searchContacts(args.query, { maxResults: args.maxResults });

      if (contacts.length === 0) {
        return `「${args.query}」に一致する連絡先が見つかりませんでした。`;
      }

      let result = `[Google Contacts] 検索結果: 「${args.query}」\n\n`;
      contacts.forEach(contact => {
        const person = contact.person;
        const name = person.names?.[0]?.displayName || '(名前なし)';
        const email = person.emailAddresses?.[0]?.value || '';
        const phone = person.phoneNumbers?.[0]?.value || '';

        result += `${name}\n`;
        if (email) result += `  Email: ${email}\n`;
        if (phone) result += `  Phone: ${phone}\n`;
        result += '\n';
      });

      return result.trim();

    } catch (error) {
      console.error('Google Contacts search error:', error);
      return `連絡先の検索に失敗しました: ${error.message}`;
    }
  }

  // Google Meet: 会議リンク作成
  async google_meet_create(args) {
    try {
      const { default: googleApiService } = await import('./googleApiService.js');

      if (!googleApiService.isAuthenticated()) {
        return 'Google連携が必要です。設定からGoogleアカウントと連携してください。';
      }

      const meetingData = {
        summary: args.summary,
        start: {
          dateTime: args.start,
          timeZone: 'Asia/Tokyo'
        },
        end: {
          dateTime: args.end,
          timeZone: 'Asia/Tokyo'
        },
        description: args.description || ''
      };

      const result = await googleApiService.createMeetingLink(meetingData);

      const startDate = new Date(args.start);
      const dateStr = startDate.toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      });

      return `[Google Meet] 会議リンクを作成しました:\n${args.summary}\n日時: ${dateStr}\nリンク: ${result.meetLink}`;

    } catch (error) {
      console.error('Google Meet create error:', error);
      return `会議リンクの作成に失敗しました: ${error.message}`;
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

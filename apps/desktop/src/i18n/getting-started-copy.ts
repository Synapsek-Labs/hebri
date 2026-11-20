import type { Locale } from './types'

export interface GettingStartedCopy {
  title: string
  subtitle: string
  open: string
  skip: string
  back: string
  next: string
  finish: string
  chooseModel: string
  imageNote: string
  steps: { title: string; body: string; action: string }[]
}

export const gettingStartedCopy: Record<Locale, GettingStartedCopy> = {
  en: {
    title: 'Welcome to Hebri',
    subtitle: 'Your first task, in four steps.',
    open: 'Setup guide',
    skip: 'Skip guide',
    back: 'Back',
    next: 'Next',
    finish: 'Done',
    chooseModel: 'Choose a model',
    imageNote: 'Example screens are in English. You can reopen this guide in Settings → About.',
    steps: [
      {
        title: '1. Connect a model',
        body: 'Use your Synapsek account, add a provider API key such as OpenRouter, or run a local model. Choose one route to start. Provider usage may have a separate cost; connecting an account does not include every model.',
        action: 'Open Providers'
      },
      {
        title: '2. Give Hebri a small, clear task',
        body: 'Start in a new chat. Say what you need and how to check the result. Add a project folder when working with files. Bits are your persistent agents; Sessions lets you return to individual chats.',
        action: 'Open Workspace settings'
      },
      {
        title: '3. Use the browser with permission',
        body: 'Open a page in Hebri’s browser and tell your Bit which tab to use. Background access has its own permission control. Seeing a page does not authorize purchases, trades or sending messages.',
        action: 'Open Browser settings'
      },
      {
        title: '4. Connect devices when you need them',
        body: 'Gateways → Hebri devices pairs computers for approved model help. Pair on both devices; use guided Tailscale setup outside your local network. This differs from switching this window to a remote gateway. Updates are in About.',
        action: 'Open Hebri devices'
      }
    ]
  },
  it: {
    title: 'Benvenuto in Hebri',
    subtitle: 'Il tuo primo compito, in quattro passi.',
    open: 'Guida alla configurazione',
    skip: 'Salta la guida',
    back: 'Indietro',
    next: 'Avanti',
    finish: 'Fine',
    chooseModel: 'Scegli un modello',
    imageNote: 'Le schermate di esempio sono in inglese. Puoi riaprire la guida in Impostazioni → Informazioni.',
    steps: [
      {
        title: '1. Collega un modello',
        body: 'Usa il tuo account Synapsek, aggiungi una chiave API di un fornitore come OpenRouter oppure esegui un modello locale. Scegli una sola opzione per iniziare. Il consumo può avere un costo separato; collegare un account non include tutti i modelli.',
        action: 'Apri Fornitori'
      },
      {
        title: '2. Assegna un compito piccolo e chiaro',
        body: 'Inizia una nuova chat. Spiega cosa vuoi e come verificare il risultato. Aggiungi una cartella di progetto per lavorare sui file. I Bits sono agenti persistenti; Sessioni permette di ritrovare le singole chat.',
        action: 'Apri le impostazioni dello spazio di lavoro'
      },
      {
        title: '3. Usa il browser con autorizzazione',
        body: 'Apri una pagina nel browser di Hebri e indica al Bit quale scheda usare. L’accesso in background richiede un’autorizzazione dedicata. Vedere una pagina non autorizza acquisti, operazioni finanziarie o invio di messaggi.',
        action: 'Apri le impostazioni del browser'
      },
      {
        title: '4. Collega altri dispositivi quando servono',
        body: 'Gateway → Dispositivi Hebri collega i computer per ricevere aiuto dai modelli autorizzati. Conferma su entrambi; fuori dalla rete locale usa la configurazione guidata Tailscale. È diverso dal collegare questa finestra a un gateway remoto. Gli aggiornamenti sono in Informazioni.',
        action: 'Apri Dispositivi Hebri'
      }
    ]
  },
  fr: {
    title: 'Bienvenue dans Hebri',
    subtitle: 'Votre première tâche en quatre étapes.',
    open: 'Guide de configuration',
    skip: 'Passer le guide',
    back: 'Retour',
    next: 'Suivant',
    finish: 'Terminer',
    chooseModel: 'Choisir un modèle',
    imageNote: 'Les exemples sont en anglais. Retrouvez ce guide dans Paramètres → À propos.',
    steps: [
      {
        title: '1. Connecter un modèle',
        body: 'Utilisez votre compte Synapsek, une clé API comme OpenRouter ou un modèle local. Choisissez une seule option pour commencer. L’utilisation peut être facturée séparément ; connecter un compte ne donne pas accès à tous les modèles.',
        action: 'Ouvrir Fournisseurs'
      },
      {
        title: '2. Donner une tâche simple et précise',
        body: 'Ouvrez une conversation. Décrivez le résultat souhaité et sa vérification. Ajoutez un dossier de projet pour travailler sur des fichiers. Les Bits sont vos agents persistants ; Sessions permet de retrouver chaque conversation.',
        action: 'Ouvrir les paramètres de l’espace de travail'
      },
      {
        title: '3. Autoriser l’utilisation du navigateur',
        body: 'Ouvrez une page dans Hebri et indiquez au Bit quel onglet utiliser. L’accès en arrière-plan possède sa propre autorisation. Voir une page n’autorise pas les achats, transactions ou envois de messages.',
        action: 'Ouvrir les paramètres du navigateur'
      },
      {
        title: '4. Connecter vos appareils si nécessaire',
        body: 'Passerelles → Appareils Hebri relie vos ordinateurs pour une aide approuvée des modèles. Confirmez sur les deux appareils ; utilisez Tailscale hors du réseau local. Cela diffère d’une fenêtre reliée à une passerelle distante. Les mises à jour sont dans À propos.',
        action: 'Ouvrir Appareils Hebri'
      }
    ]
  },
  de: {
    title: 'Willkommen bei Hebri',
    subtitle: 'Deine erste Aufgabe in vier Schritten.',
    open: 'Einrichtungsanleitung',
    skip: 'Anleitung überspringen',
    back: 'Zurück',
    next: 'Weiter',
    finish: 'Fertig',
    chooseModel: 'Modell auswählen',
    imageNote: 'Die Beispielbilder sind auf Englisch. Die Anleitung bleibt unter Einstellungen → Über verfügbar.',
    steps: [
      {
        title: '1. Ein Modell verbinden',
        body: 'Nutze dein Synapsek-Konto, einen API-Schlüssel etwa von OpenRouter oder ein lokales Modell. Wähle zunächst einen Weg. Die Nutzung kann separat kostenpflichtig sein; ein verbundenes Konto enthält nicht alle Modelle.',
        action: 'Anbieter öffnen'
      },
      {
        title: '2. Eine kleine, klare Aufgabe stellen',
        body: 'Beginne einen neuen Chat. Beschreibe das gewünschte Ergebnis und seine Prüfung. Füge für Dateien einen Projektordner hinzu. Bits sind dauerhafte Agenten; unter Sitzungen findest du einzelne Chats wieder.',
        action: 'Arbeitsbereich-Einstellungen öffnen'
      },
      {
        title: '3. Browserzugriff bewusst erlauben',
        body: 'Öffne eine Seite in Hebri und sage dem Bit, welchen Tab es nutzen soll. Hintergrundzugriff benötigt eine eigene Erlaubnis. Das Anzeigen einer Seite erlaubt keine Käufe, Finanztransaktionen oder Nachrichten.',
        action: 'Browser-Einstellungen öffnen'
      },
      {
        title: '4. Bei Bedarf Geräte verbinden',
        body: 'Gateways → Hebri-Geräte verbindet Computer für erlaubte Modellhilfe. Bestätige auf beiden Geräten; nutze die Tailscale-Anleitung außerhalb des lokalen Netzes. Das unterscheidet sich von einem entfernten Gateway für dieses Fenster. Updates findest du unter Über.',
        action: 'Hebri-Geräte öffnen'
      }
    ]
  },
  es: {
    title: 'Bienvenido a Hebri',
    subtitle: 'Tu primera tarea en cuatro pasos.',
    open: 'Guía de configuración',
    skip: 'Omitir guía',
    back: 'Atrás',
    next: 'Siguiente',
    finish: 'Listo',
    chooseModel: 'Elegir un modelo',
    imageNote: 'Las imágenes de ejemplo están en inglés. Puedes volver a la guía en Ajustes → Acerca de.',
    steps: [
      {
        title: '1. Conecta un modelo',
        body: 'Usa tu cuenta Synapsek, una clave API como OpenRouter o un modelo local. Elige una opción para empezar. El uso puede tener un coste aparte; conectar una cuenta no incluye todos los modelos.',
        action: 'Abrir Proveedores'
      },
      {
        title: '2. Pide una tarea pequeña y clara',
        body: 'Empieza un chat nuevo. Explica qué necesitas y cómo comprobar el resultado. Añade una carpeta de proyecto para trabajar con archivos. Los Bits son agentes persistentes; Sesiones permite volver a cada chat.',
        action: 'Abrir ajustes del espacio de trabajo'
      },
      {
        title: '3. Autoriza el acceso al navegador',
        body: 'Abre una página en Hebri e indica al Bit qué pestaña usar. El acceso en segundo plano tiene su propio permiso. Ver una página no autoriza compras, operaciones financieras ni envío de mensajes.',
        action: 'Abrir ajustes del navegador'
      },
      {
        title: '4. Conecta dispositivos cuando los necesites',
        body: 'Gateways → Dispositivos Hebri conecta ordenadores para recibir ayuda de modelos autorizados. Confirma en ambos; usa la guía Tailscale fuera de la red local. Es distinto de conectar esta ventana a un gateway remoto. Las actualizaciones están en Acerca de.',
        action: 'Abrir Dispositivos Hebri'
      }
    ]
  },
  ja: {
    title: 'Hebri へようこそ',
    subtitle: '4つのステップで最初のタスクへ。',
    open: 'セットアップガイド',
    skip: 'ガイドをスキップ',
    back: '戻る',
    next: '次へ',
    finish: '完了',
    chooseModel: 'モデルを選ぶ',
    imageNote: '例の画面は英語です。設定 → このアプリについてから再度開けます。',
    steps: [
      {
        title: '1. モデルを接続する',
        body: 'Synapsek アカウント、OpenRouter などの API キー、またはローカルモデルを使います。まず1つ選んでください。利用料金は別途発生する場合があり、接続だけですべてのモデルが使えるわけではありません。',
        action: 'プロバイダーを開く'
      },
      {
        title: '2. 小さく明確なタスクを頼む',
        body: '新しいチャットで、必要な結果と確認方法を伝えます。ファイルを扱う場合はプロジェクトフォルダーを追加します。Bits は継続的なエージェントで、セッションから個別のチャットに戻れます。',
        action: 'ワークスペース設定を開く'
      },
      {
        title: '3. ブラウザーの操作を許可する',
        body: 'Hebri でページを開き、使用するタブを Bit に伝えます。バックグラウンドアクセスには別の許可が必要です。ページの閲覧は購入、取引、メッセージ送信の許可にはなりません。',
        action: 'ブラウザー設定を開く'
      },
      {
        title: '4. 必要なときにデバイスを接続する',
        body: 'ゲートウェイ → Hebri デバイスで承認したモデルの支援を共有します。両方でペアリングを確認し、ローカルネットワーク外では Tailscale の案内を使います。ウィンドウのリモートゲートウェイ接続とは別です。更新はアプリ情報から行います。',
        action: 'Hebri デバイスを開く'
      }
    ]
  },
  zh: {
    title: '欢迎使用 Hebri',
    subtitle: '四步开始你的第一个任务。',
    open: '设置指南',
    skip: '跳过指南',
    back: '上一步',
    next: '下一步',
    finish: '完成',
    chooseModel: '选择模型',
    imageNote: '示例截图为英文。可在设置 → 关于中重新打开指南。',
    steps: [
      {
        title: '1. 连接模型',
        body: '使用 Synapsek 账户、OpenRouter 等提供商的 API 密钥，或本地模型。先选一种方式即可。使用费用可能另行收取；连接账户不代表包含所有模型。',
        action: '打开提供商'
      },
      {
        title: '2. 提出明确的小任务',
        body: '新建聊天，说明需要什么以及如何检查结果。处理文件时添加项目文件夹。Bits 是持续使用的智能体；会话可让你返回各个聊天。',
        action: '打开工作区设置'
      },
      {
        title: '3. 授权浏览器访问',
        body: '在 Hebri 中打开网页，告诉 Bit 使用哪个标签页。后台访问有单独的权限控制。能看到网页不代表获准购买、交易或发送消息。',
        action: '打开浏览器设置'
      },
      {
        title: '4. 按需连接设备',
        body: '网关 → Hebri 设备可连接电脑，获得已授权模型的帮助。两端均需确认配对；在本地网络之外使用 Tailscale 设置向导。这与将当前窗口连接到远程网关不同。更新位于关于页面。',
        action: '打开 Hebri 设备'
      }
    ]
  },
  'zh-hant': {
    title: '歡迎使用 Hebri',
    subtitle: '四步開始你的第一個任務。',
    open: '設定指南',
    skip: '略過指南',
    back: '上一步',
    next: '下一步',
    finish: '完成',
    chooseModel: '選擇模型',
    imageNote: '範例截圖為英文。可在設定 → 關於中重新開啟指南。',
    steps: [
      {
        title: '1. 連接模型',
        body: '使用 Synapsek 帳戶、OpenRouter 等供應商的 API 金鑰，或本機模型。先選一種方式即可。使用費用可能另計；連接帳戶不代表包含所有模型。',
        action: '開啟供應商'
      },
      {
        title: '2. 提出明確的小任務',
        body: '建立新對話，說明需要什麼以及如何檢查結果。處理檔案時新增專案資料夾。Bits 是持續使用的代理；工作階段可讓你返回各個對話。',
        action: '開啟工作區設定'
      },
      {
        title: '3. 授權瀏覽器存取',
        body: '在 Hebri 中開啟網頁，告訴 Bit 使用哪個分頁。背景存取有獨立的權限控制。能看到網頁不代表獲准購買、交易或傳送訊息。',
        action: '開啟瀏覽器設定'
      },
      {
        title: '4. 按需連接裝置',
        body: '閘道 → Hebri 裝置可連接電腦，取得已授權模型的協助。兩端均需確認配對；在區域網路之外使用 Tailscale 設定指南。這與將目前視窗連接到遠端閘道不同。更新位於關於頁面。',
        action: '開啟 Hebri 裝置'
      }
    ]
  },
  ru: {
    title: 'Добро пожаловать в Hebri',
    subtitle: 'Первая задача за четыре шага.',
    open: 'Руководство по настройке',
    skip: 'Пропустить',
    back: 'Назад',
    next: 'Далее',
    finish: 'Готово',
    chooseModel: 'Выбрать модель',
    imageNote: 'Примеры экранов на английском. Руководство доступно в Настройки → О приложении.',
    steps: [
      {
        title: '1. Подключите модель',
        body: 'Используйте аккаунт Synapsek, API-ключ OpenRouter или другого провайдера либо локальную модель. Для начала выберите один вариант. Использование может оплачиваться отдельно; подключение аккаунта не включает все модели.',
        action: 'Открыть провайдеров'
      },
      {
        title: '2. Дайте небольшую понятную задачу',
        body: 'Откройте новый чат. Опишите результат и способ его проверки. Для работы с файлами добавьте папку проекта. Bits — постоянные агенты; раздел сеансов позволяет вернуться к отдельным чатам.',
        action: 'Открыть настройки рабочего пространства'
      },
      {
        title: '3. Разрешайте доступ к браузеру',
        body: 'Откройте страницу в Hebri и укажите Bit нужную вкладку. Для фонового доступа предусмотрено отдельное разрешение. Просмотр страницы не разрешает покупки, финансовые операции или отправку сообщений.',
        action: 'Открыть настройки браузера'
      },
      {
        title: '4. При необходимости подключите устройства',
        body: 'Шлюзы → Устройства Hebri связывает компьютеры для помощи разрешённых моделей. Подтвердите сопряжение с обеих сторон; вне локальной сети используйте мастер Tailscale. Это отличается от подключения окна к удалённому шлюзу. Обновления находятся в разделе О приложении.',
        action: 'Открыть устройства Hebri'
      }
    ]
  },
  ar: {
    title: 'مرحبًا بك في Hebri',
    subtitle: 'مهمتك الأولى في أربع خطوات.',
    open: 'دليل الإعداد',
    skip: 'تخطي الدليل',
    back: 'السابق',
    next: 'التالي',
    finish: 'تم',
    chooseModel: 'اختر نموذجًا',
    imageNote: 'صور الأمثلة باللغة الإنجليزية. يمكنك فتح الدليل مجددًا من الإعدادات ← حول.',
    steps: [
      {
        title: '1. صِل نموذجًا',
        body: 'استخدم حساب Synapsek أو مفتاح API لمزوّد مثل OpenRouter أو نموذجًا محليًا. اختر طريقة واحدة للبدء. قد تُحتسب رسوم الاستخدام بشكل منفصل؛ ربط الحساب لا يشمل جميع النماذج.',
        action: 'فتح المزوّدين'
      },
      {
        title: '2. اطلب مهمة صغيرة وواضحة',
        body: 'ابدأ محادثة جديدة واشرح المطلوب وكيفية التحقق من النتيجة. أضف مجلد مشروع عند العمل على الملفات. Bits هم وكلاؤك المستمرون، ويمكنك العودة إلى المحادثات من الجلسات.',
        action: 'فتح إعدادات مساحة العمل'
      },
      {
        title: '3. امنح الإذن لاستخدام المتصفح',
        body: 'افتح صفحة في متصفح Hebri وحدد للوكيل علامة التبويب المطلوبة. الوصول في الخلفية له إذن مستقل. رؤية الصفحة لا تمنح إذنًا للشراء أو التداول أو إرسال الرسائل.',
        action: 'فتح إعدادات المتصفح'
      },
      {
        title: '4. صِل الأجهزة عند الحاجة',
        body: 'البوابات ← أجهزة Hebri تربط الحواسيب للمساعدة عبر النماذج المصرّح بها. أكّد الاقتران على الجهازين، واستخدم دليل Tailscale خارج الشبكة المحلية. هذا يختلف عن توصيل النافذة ببوابة بعيدة. التحديثات موجودة في حول.',
        action: 'فتح أجهزة Hebri'
      }
    ]
  }
}

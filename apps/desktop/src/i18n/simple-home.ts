import type { Locale } from './types'

export interface SimpleHomeCopy {
  title: string
  description: string
  starters: { label: string; prompt: string }[]
}

/** Local UI copy. Starters only insert an editable draft; they never submit it. */
export const simpleHomeCopy: Record<Locale, SimpleHomeCopy> = {
  en: {
    title: 'What would you like to get done?',
    description: 'Start with a task, or choose an example and make it your own.',
    starters: [
      {
        label: 'Write something',
        prompt: 'Help me draft a clear message about '
      },
      {
        label: 'Research a topic',
        prompt: 'Research this topic and compare reliable sources: '
      },
      {
        label: 'Make a plan',
        prompt: 'Help me turn this goal into a practical plan: '
      }
    ]
  },
  de: {
    title: 'Was möchtest du erledigen?',
    description: 'Beschreibe eine Aufgabe oder passe ein Beispiel an.',
    starters: [
      {
        label: 'Etwas schreiben',
        prompt: 'Hilf mir, eine klare Nachricht zu diesem Thema zu schreiben: '
      },
      {
        label: 'Ein Thema recherchieren',
        prompt: 'Recherchiere dieses Thema und vergleiche verlässliche Quellen: '
      },
      {
        label: 'Einen Plan erstellen',
        prompt: 'Hilf mir, aus diesem Ziel einen konkreten Plan zu machen: '
      }
    ]
  },
  fr: {
    title: 'Que souhaitez-vous accomplir ?',
    description: 'Décrivez une tâche ou adaptez un exemple à vos besoins.',
    starters: [
      {
        label: 'Rédiger un texte',
        prompt: 'Aide-moi à rédiger un message clair sur '
      },
      {
        label: 'Explorer un sujet',
        prompt: 'Recherche ce sujet et compare des sources fiables : '
      },
      {
        label: 'Préparer un plan',
        prompt: 'Aide-moi à transformer cet objectif en un plan concret : '
      }
    ]
  },
  it: {
    title: 'Cosa vuoi fare?',
    description: 'Descrivi un’attività oppure scegli un esempio e adattalo.',
    starters: [
      {
        label: 'Scrivere un testo',
        prompt: 'Aiutami a scrivere un messaggio chiaro su '
      },
      {
        label: 'Cercare informazioni',
        prompt: 'Cerca informazioni su questo argomento e confronta fonti affidabili: '
      },
      {
        label: 'Creare un piano',
        prompt: 'Aiutami a trasformare questo obiettivo in un piano concreto: '
      }
    ]
  },
  es: {
    title: '¿Qué te gustaría hacer?',
    description: 'Describe una tarea o elige un ejemplo y adáptalo.',
    starters: [
      {
        label: 'Escribir un texto',
        prompt: 'Ayúdame a redactar un mensaje claro sobre '
      },
      {
        label: 'Investigar un tema',
        prompt: 'Investiga este tema y compara fuentes fiables: '
      },
      {
        label: 'Crear un plan',
        prompt: 'Ayúdame a convertir este objetivo en un plan práctico: '
      }
    ]
  },
  ja: {
    title: '何を進めたいですか？',
    description: 'やりたいことを書くか、例を選んで編集してください。',
    starters: [
      {
        label: '文章を書く',
        prompt: '次の内容について、わかりやすいメッセージの下書きを手伝ってください：'
      },
      {
        label: 'テーマを調べる',
        prompt: '次のテーマを調べ、信頼できる情報源を比較してください：'
      },
      {
        label: '計画を立てる',
        prompt: '次の目標を具体的な計画にするのを手伝ってください：'
      }
    ]
  },
  zh: {
    title: '你想完成什么？',
    description: '描述一项任务，或选择示例并按需要修改。',
    starters: [
      {
        label: '写点东西',
        prompt: '帮我起草一段清晰的文字，主题是：'
      },
      {
        label: '研究主题',
        prompt: '研究以下主题，并比较可靠来源：'
      },
      {
        label: '制定计划',
        prompt: '帮我把以下目标变成切实可行的计划：'
      }
    ]
  },
  'zh-hant': {
    title: '你想完成什麼？',
    description: '描述一項任務，或選擇範例並按需要修改。',
    starters: [
      {
        label: '寫點東西',
        prompt: '幫我起草一段清晰的文字，主題是：'
      },
      {
        label: '研究主題',
        prompt: '研究以下主題，並比較可靠來源：'
      },
      {
        label: '制定計畫',
        prompt: '幫我把以下目標變成可行的計畫：'
      }
    ]
  },
  ar: {
    title: 'ما الذي تريد إنجازه؟',
    description: 'صف مهمة، أو اختر مثالًا وعدّله كما تريد.',
    starters: [
      {
        label: 'كتابة نص',
        prompt: 'ساعدني في صياغة رسالة واضحة حول '
      },
      {
        label: 'البحث في موضوع',
        prompt: 'ابحث في هذا الموضوع وقارن المصادر الموثوقة: '
      },
      {
        label: 'إعداد خطة',
        prompt: 'ساعدني في تحويل هذا الهدف إلى خطة عملية: '
      }
    ]
  },
  ru: {
    title: 'Что вы хотите сделать?',
    description: 'Опишите задачу или выберите пример и измените его.',
    starters: [
      {
        label: 'Написать текст',
        prompt: 'Помоги составить понятное сообщение о '
      },
      {
        label: 'Изучить тему',
        prompt: 'Изучи эту тему и сравни надёжные источники: '
      },
      {
        label: 'Составить план',
        prompt: 'Помоги превратить эту цель в практический план: '
      }
    ]
  }
}

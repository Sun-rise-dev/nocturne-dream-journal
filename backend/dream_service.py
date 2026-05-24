"""
Nocturne · 梦境整理服务 — AI 叙事整理 + 关键词提取 + 情绪识别
"""
import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)


class DreamService:
    """梦境整理服务：将碎片语音转写整理为连贯叙事"""

    def __init__(self):
        self.prompt_template = self._load_prompt()
        self._text_client = None

    def _load_prompt(self) -> str:
        path = Path(__file__).parent / 'prompts' / 'dream_prompt.txt'
        if path.exists():
            return path.read_text(encoding='utf-8')
        return '{text}'

    def _get_text_client(self):
        """复用红墨的文本生成客户端"""
        if self._text_client is None:
            try:
                import yaml
                from backend.utils.text_client import get_text_chat_client
                config_path = Path.cwd() / 'text_providers.yaml'
                if config_path.exists():
                    with open(config_path, 'r', encoding='utf-8') as f:
                        config = yaml.safe_load(f) or {}
                    active = config.get('active_provider', '')
                    providers = config.get('providers', {})
                    provider_config = providers.get(active, {})
                    if provider_config.get('api_key'):
                        self._text_client = get_text_chat_client(provider_config)
                        logger.info(f"文本客户端已初始化: {active}")
            except Exception as e:
                logger.warning(f"无法初始化文本客户端: {e}")
        return self._text_client

    def process(self, text: str) -> dict:
        """
        处理梦境转写文本
        返回: {success, narrative, emotion, keywords, title}
        """
        # 本地处理（不需要 AI 也能跑）
        emotion = self._detect_emotion(text)
        keywords = self._extract_keywords(text)
        title = self._generate_title(text)

        # 尝试 AI 叙事整理
        client = self._get_text_client()
        if client:
            try:
                prompt = self.prompt_template.format(text=text)
                response = client.generate_text(
                    prompt=prompt,
                    model=None,
                    temperature=0.7,
                    max_output_tokens=1024,
                )
                narrative = response.strip()
                logger.info(f"AI 叙事整理完成: {len(narrative)} 字")
                return {
                    'success': True,
                    'narrative': narrative,
                    'emotion': emotion,
                    'keywords': keywords,
                    'title': title,
                }
            except Exception as e:
                logger.warning(f"AI 调用失败，使用本地处理: {e}")

        # 本地降级：清理文本作为叙事
        cleaned = self._clean_text(text)
        return {
            'success': True,
            'narrative': cleaned,
            'emotion': emotion,
            'keywords': keywords,
            'title': title,
        }

    def _detect_emotion(self, text: str) -> str:
        """本地情绪检测"""
        patterns = {
            'fear': ['害怕', '恐惧', '逃跑', '黑暗', '追赶', '坠落', '死亡', '血'],
            'joy': ['开心', '笑', '美', '幸福', '温暖', '爱', '光明', '彩虹'],
            'calm': ['安静', '水', '湖', '海', '风', '云', '月', '星星', '花'],
            'anxiety': ['考试', '迟到', '找', '迷路', '丢', '忘', '急', '错'],
            'wonder': ['飞', '魔法', '变', '穿越', '巨大', '奇怪', '宇宙', '光'],
            'sad': ['哭', '难过', '失去', '离别', '死', '老', '病', '泪'],
            'strange': ['扭曲', '颠倒', '动物', '说话', '变成', '平行', '无限'],
        }
        scores = {}
        for emotion, words in patterns.items():
            scores[emotion] = sum(text.count(w) for w in words)
        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else 'wonder'

    def _extract_keywords(self, text: str) -> list:
        stop = {'的','了','是','我','在','有','和','就','不','人','都','一','个',
                '上','也','很','到','说','要','去','你','会','着','没有','看','好',
                '自己','这','那','什么','怎么','为什么','一个','然后','就是','好像',
                '感觉','觉得','有点','像是','大概','可能','应该','已经','忽然','突然'}
        words = re.findall(r'[一-鿿]{2,}', text)
        filtered = [w for w in words if w not in stop]
        freq = {}
        for w in filtered:
            freq[w] = freq.get(w, 0) + 1
        sorted_words = sorted(freq.items(), key=lambda x: -x[1])
        return [w for w, _ in sorted_words[:8]]

    def _generate_title(self, text: str) -> str:
        """从内容生成简短标题"""
        clean = text.replace('...', ' ').replace('，', ' ').replace('。', ' ')
        words = clean.strip().split()
        return ' '.join(words[:8]) if words else '未命名之梦'

    def _clean_text(self, text: str) -> str:
        """本地清理文本：去重复词、加标点"""
        text = re.sub(r'(\S)\1{2,}', r'\1\1', text)
        return text.strip()

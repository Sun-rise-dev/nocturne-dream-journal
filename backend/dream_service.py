"""
Nocturne · 梦境整理服务 — AI 叙事整理 + 关键词提取 + 情绪识别 + 梦境插图
"""
import base64
import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

# Image generation config — loaded from environment variables
IMAGE_API_BASE = os.environ.get('IMAGE_API_BASE', 'https://shiyunapi.com')
IMAGE_API_KEY = os.environ.get('IMAGE_API_KEY', '')
IMAGE_MODEL = os.environ.get('IMAGE_MODEL', 'gemini-3.1-flash-image-preview')


class DreamService:
    def __init__(self):
        self.prompt_template = self._load_prompt()
        self._text_client = None

    def _load_prompt(self) -> str:
        path = Path(__file__).parent / 'prompts' / 'dream_prompt.txt'
        if path.exists():
            return path.read_text(encoding='utf-8')
        return '{text}'

    def _get_text_client(self):
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
                        logger.info(f"Text client initialized: {active}")
            except Exception as e:
                logger.warning(f"Cannot init text client: {e}")
        return self._text_client

    def process(self, text: str) -> dict:
        emotion = self._detect_emotion(text)
        keywords = self._extract_keywords(text)
        title = self._generate_title(text)

        client = self._get_text_client()
        if client:
            try:
                prompt = self.prompt_template.format(text=text)
                response = client.generate_text(
                    prompt=prompt, model=None, temperature=0.7, max_output_tokens=1024,
                )
                narrative = response.strip()
                logger.info(f"AI narrative: {len(narrative)} chars")

                # Generate dream illustration
                image_url = self._generate_image(narrative, keywords, emotion)

                return {
                    'success': True, 'narrative': narrative,
                    'emotion': emotion, 'keywords': keywords, 'title': title,
                    'image_url': image_url,
                }
            except Exception as e:
                logger.warning(f"AI call failed, local fallback: {e}")

        cleaned = self._clean_text(text)
        return {
            'success': True, 'narrative': cleaned,
            'emotion': emotion, 'keywords': keywords, 'title': title,
            'image_url': None,
        }

    def _generate_image(self, narrative: str, keywords: list, emotion: str) -> str | None:
        """Generate dream illustration via image API (server-side only)"""
        if not IMAGE_API_KEY:
            logger.warning("IMAGE_API_KEY not set — skipping image generation")
            return None
        try:
            import requests

            emotion_moods = {
                'fear': 'dark and mysterious atmosphere, deep purple and blue tones',
                'joy': 'warm golden light, bright and radiant atmosphere',
                'calm': 'serene and peaceful, soft blue and teal tones',
                'anxiety': 'tense and surreal, fragmented light and shadow',
                'wonder': 'magical and ethereal, shimmering starlight and iridescent colors',
                'sad': 'melancholic and quiet, soft grey and muted blue tones',
                'strange': 'surreal and dreamlike, impossible geometry and floating elements',
            }
            mood = emotion_moods.get(emotion, 'dreamlike and ethereal')

            image_prompt = (
                f"Create a dreamlike illustration for a dream. Atmosphere: {mood}. "
                f"Style: soft watercolor meets oil painting, misty edges, luminous quality. "
                f"Key elements from the dream: {', '.join(keywords[:5]) if keywords else 'surreal landscape'}. "
                f"Dream narrative essence: {narrative[:200]}. "
                f"Aspect ratio 3:4, vertical composition. No text, no borders."
            )

            logger.info(f"Generating image, prompt: {image_prompt[:100]}...")

            resp = requests.post(
                f'{IMAGE_API_BASE}/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {IMAGE_API_KEY}',
                    'Content-Type': 'application/json',
                },
                json={
                    'model': IMAGE_MODEL,
                    'messages': [{'role': 'user', 'content': image_prompt}],
                    'max_tokens': 4096,
                    'temperature': 1.0,
                },
                timeout=120,
            )

            if resp.status_code != 200:
                logger.error(f"Image API error: {resp.status_code} {resp.text[:200]}")
                return None

            result = resp.json()
            content = result.get('choices', [{}])[0].get('message', {}).get('content', '')

            # Parse markdown image URL
            urls = re.findall(r'!\[.*?\]\((https?://[^\s)]+)\)', content)
            if urls:
                logger.info(f"Image URL extracted: {urls[0][:80]}...")
                return urls[0]

            # Parse base64
            if content.startswith('data:image'):
                # For Vercel deployment, store base64 directly
                logger.info("Image: base64 data URL")
                return content

            logger.warning(f"No image found in response: {str(content)[:200]}")
            return None

        except Exception as e:
            logger.warning(f"Image generation failed: {e}")
            return None

    def _detect_emotion(self, text: str) -> str:
        patterns = {
            'fear': [
                '害怕', '恐惧', '逃跑', '黑暗', '追赶', '坠落', '死亡', '血', '鬼', '怪物',
                '噩梦', '吓', '恐怖', '尖叫', '逃', '躲', '黑', '巷', '深渊', '窒息',
                '棺材', '僵尸', '墓地', '骷髅', '蛇', '蜘蛛', '封闭', '困', '陷阱', '淹没',
                'afraid', 'fear', 'scared', 'terrified', 'monster', 'dark', 'chase',
                'falling', 'death', 'nightmare', 'horror', 'ghost', 'scream', 'run',
                'hide', 'trapped', 'drowning', 'shadow', 'evil', 'demon',
            ],
            'joy': [
                '开心', '笑', '美', '幸福', '温暖', '爱', '光明', '彩虹', '拥抱', '礼物',
                '庆祝', '鲜花', '甜', '阳光', '婚礼', '孩子', '团聚', '成功', '胜利', '拥抱',
                'happy', 'love', 'light', 'warm', 'beautiful', 'joy', 'smile', 'laugh',
                'celebration', 'sun', 'flower', 'gift', 'hug', 'peace', 'heaven',
            ],
            'calm': [
                '安静', '水', '湖', '海', '风', '云', '月', '星星', '花', '雪', '山', '林',
                '田野', '草原', '日落', '黄昏', '晨曦', '微光', '宁静', '安详', '缓慢', '漂浮',
                '河', '溪', '清晨', '寺庙', '冥想', '呼吸', '静', '躺', '散步',
                'calm', 'water', 'lake', 'ocean', 'wind', 'moon', 'star', 'quiet',
                'peaceful', 'slow', 'float', 'forest', 'river', 'sunset', 'snow',
                'meditation', 'zen', 'gentle', 'breeze',
            ],
            'anxiety': [
                '考试', '迟到', '找', '迷路', '丢', '忘', '急', '错', '裸体', '没准备',
                '赶不上', '错过', '晚点', '空', '独自', '等待', '反复', '重复', '拥挤',
                '电梯', '楼梯', '断', '碎', '烂', '坏', '紧张', '担心', '焦虑', '慌',
                'exam', 'late', 'lost', 'forgot', 'anxious', 'naked', 'unprepared',
                'missed', 'wait', 'repeat', 'stuck', 'broken', 'rush', 'hurry',
                'embarrassed', 'shame', 'failure', 'test', 'nervous', 'worried',
            ],
            'wonder': [
                '飞', '魔法', '变', '穿越', '巨大', '奇怪', '宇宙', '光', '翅膀', '神奇',
                '异世界', '幻想', '星辰', '银河', '龙', '精灵', '宫殿', '仙境', '不可思议',
                '奇迹', '瑰丽', '灿烂', '绚丽', '神奇', '展现', '翱翔', '升腾',
                'fly', 'magic', 'transform', 'cosmic', 'giant', 'wonder', 'fantasy',
                'dragon', 'fairy', 'castle', 'portal', 'galaxy', 'wings', 'miraculous',
                'enchanted', 'mystical', 'ethereal', 'divine', 'celestial', 'spell',
            ],
            'sad': [
                '哭', '难过', '失去', '离别', '死', '老', '病', '泪', '悲伤', '孤独',
                '寂寞', '哀伤', '痛苦', '心碎', '分手', '离婚', '葬礼', '坟墓', '遗憾',
                '怀念', '回不去', '再也', '没有', '想', '念', '无奈', '叹息',
                'cry', 'sad', 'loss', 'goodbye', 'sorrow', 'lonely', 'alone', 'grief',
                'pain', 'heartbreak', 'tears', 'funeral', 'grave', 'miss', 'regret',
                'empty', 'cold', 'rain', 'grey', 'gray',
            ],
            'strange': [
                '扭曲', '颠倒', '动物', '说话', '变成', '平行', '无限', '超现实', '荒诞',
                '错位', '拼接', '融化', '变形', '分身', '时间', '循环', '悖论', '混乱',
                '碎片', '重叠', '不真实', '诡异', '异样', '多重', '人格', '梦中梦',
                'surreal', 'twisted', 'animal', 'talking', 'strange', 'bizarre',
                'weird', 'absurd', 'melt', 'shift', 'morph', 'parallel', 'loop',
                'distort', 'warp', 'fragment', 'double', 'clone', 'impossible',
            ],
        }
        scores = {}
        for emotion, words in patterns.items():
            scores[emotion] = sum(text.count(w) for w in words)
        # Sort by score; if top two are tied, pick randomly among tied ones
        sorted_pairs = sorted(scores.items(), key=lambda x: -x[1])
        best_score = sorted_pairs[0][1]
        if best_score > 0:
            # If multiple emotions share the top score, pick one at random
            tied = [e for e, s in sorted_pairs if s == best_score]
            import random
            return random.choice(tied)
        # No keywords matched → pick a random emotion (not just 'wonder' every time)
        import random
        return random.choice(list(patterns.keys()))

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
        clean = text.replace('...', ' ').replace('，', ' ').replace('。', ' ')
        words = clean.strip().split()
        return ' '.join(words[:8]) if words else '未命名之梦'

    def _clean_text(self, text: str) -> str:
        text = re.sub(r'(\S)\1{2,}', r'\1\1', text)
        return text.strip()

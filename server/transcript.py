import json,sys,warnings
warnings.filterwarnings('ignore')
from youtube_transcript_api import YouTubeTranscriptApi
try:
 api=YouTubeTranscriptApi()
 tracks=api.list(sys.argv[1])
 try: track=tracks.find_transcript(['zh-Hans','zh-Hant','zh','en'])
 except Exception: track=next(iter(tracks))
 data=track.fetch()
 print(json.dumps({'language':data.language,'segments':data.to_raw_data()},ensure_ascii=False))
except Exception as exc:
 print(json.dumps({'error':type(exc).__name__+': 无法获取这条视频的公开字幕。可能没有字幕、地区限制或平台暂时限制读取。可导入文字稿后继续。'},ensure_ascii=False))
 sys.exit(1)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
吾輩は猫であるのテキストファイルをdata-format.mdの仕様に従ってJSONに変換するスクリプト
"""

import json
import re
import sys
import os


def parse_text_file(file_path):
    """
    テキストファイルを読み込んでJSONフォーマットに変換
    """
    import codecs
    with codecs.open(file_path, 'r', 'utf-8') as f:
        content = f.read()

    lines = content.split('\n')

    # メタデータを抽出
    title = lines[0].strip()
    author = lines[1].strip()

    # 章ごとに分割
    chapters = []
    current_chapter = None
    current_block_id = 1

    # "一" や "二" のような章番号を検出（直接文字比較で対応）
    chapter_chars = [u'一', u'二', u'三', u'四', u'五', u'六', u'七', u'八', u'九', u'十', u'十一']

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # デバッグ用（削除予定）
        # if i < 20:
        #     print("Processing line %d: [%s]" % (i, repr(line)))
        #     if line in chapter_chars:
        #         print("  -> Chapter detected!")

        # 章の開始を検出
        if line and line in chapter_chars:
            # 前の章を保存
            if current_chapter:
                chapters.append(current_chapter)

            # 新しい章を開始
            chapter_id = len(chapters) + 1
            current_chapter = {
                "id": chapter_id,
                "title": line,
                "blocks": []
            }
            current_block_id = 1
            i += 1
            continue

        # 本文を処理（章が始まった後のみ処理）
        if current_chapter is not None:
            stripped_line = line.strip()


            # 段落の開始を検出（空でない行で、章タイトルでない行）
            if stripped_line and stripped_line not in chapter_chars and stripped_line != u'+目次':
                # 一つの段落として処理（現在の行のみ）
                paragraph_text = stripped_line

                # ブロックタイプを判定（会話文：「で始まり」で終わる行のみ）
                is_conversation = (
                    paragraph_text.startswith(u"「") and
                    paragraph_text.endswith(u"」")
                )
                block_type = "conversation" if is_conversation else "paragraph"

                # デバッグ情報（会話文の判定結果を表示）
                if is_conversation:
                    print(f"[CONVERSATION] Chapter {current_chapter['id']}, Block {current_block_id}: {paragraph_text[:50]}...")

                block = {
                    "id": current_block_id,
                    "type": block_type,
                    "text": paragraph_text
                }
                current_chapter["blocks"].append(block)
                current_block_id += 1

        i += 1

    # 最後の章を追加
    if current_chapter:
        chapters.append(current_chapter)

    # JSONフォーマットを構築
    result = {
        "metadata": {
            "id": 1,
            "title": title,
            "author": author
        },
        "content": {
            "chapters": chapters
        }
    }

    return result


def main():
    # ファイルパスを設定
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    input_file = os.path.join(project_root, "original", "吾輩は猫である.txt")
    output_file = os.path.join(project_root, "lib", "mock-data", "wagahai.json")

    # 出力ディレクトリを作成
    output_dir = os.path.dirname(output_file)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    if not os.path.exists(input_file):
        print("Error: Input file not found: " + input_file)
        sys.exit(1)

    try:
        print("Converting " + input_file + " to JSON...")
        result = parse_text_file(input_file)

        # JSONファイルに保存
        import codecs
        with codecs.open(output_file, 'w', 'utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print("Successfully converted to: " + output_file)
        print("Created " + str(len(result['content']['chapters'])) + " chapters")

        # 統計情報を表示
        total_blocks = sum(len(chapter['blocks']) for chapter in result['content']['chapters'])
        conversation_blocks = sum(
            len([block for block in chapter['blocks'] if block['type'] == 'conversation'])
            for chapter in result['content']['chapters']
        )
        paragraph_blocks = total_blocks - conversation_blocks

        print("Total blocks: " + str(total_blocks))
        print("Conversation blocks: " + str(conversation_blocks))
        print("Paragraph blocks: " + str(paragraph_blocks))
        print("Conversation ratio: {:.1f}%".format((conversation_blocks / total_blocks) * 100 if total_blocks > 0 else 0))

    except Exception as e:
        print("Error during conversion: " + str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
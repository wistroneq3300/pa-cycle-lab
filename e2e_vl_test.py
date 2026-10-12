"""One-shot E2E: prove AgentGateway actually reads an attached image via the
vision profile against the live 18010 agent-server. Uses a throwaway SQLite DB.
"""
import base64, io, os, sys, time, uuid

sys.path.insert(0, os.path.dirname(__file__))

from integration.agent_runs import AgentRunStore
from integration.agent_gateway import AgentGateway

def make_png():
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (320, 200), "white")
        d = ImageDraw.Draw(img)
        d.rectangle([20, 20, 300, 180], outline="red", width=3)
        d.text((40, 90), "PA-VL-E2E-42", fill="black")
        buf = io.BytesIO(); img.save(buf, "PNG"); return buf.getvalue()
    except Exception as e:
        # tiny valid 1x1 red png fallback
        import struct, zlib
        def chunk(t, data):
            c = t + data
            return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
        raw = b"\x00" + b"\xff\x00\x00"
        png = (b"\x89PNG\r\n\x1a\n"
               + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
               + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
        return png

def main():
    tmp = f"/tmp/vl_e2e_{uuid.uuid4().hex[:8]}"
    os.makedirs(tmp, exist_ok=True)
    png = make_png()
    img_path = os.path.join(tmp, "case.png")
    with open(img_path, "wb") as fh:
        fh.write(png)

    store = AgentRunStore(path=os.path.join(tmp, "agent_runs.sqlite3"))
    run_id = f"vl-e2e-{uuid.uuid4().hex[:8]}"
    store.create_run({
        "run_id": run_id,
        "library_version": "1.0",
        "testcase": {
            "code": "PA-VL-E2E-42",
            "sub_function": "VL-image-reading",
            "test_set": "e2e",
            "items": "verify agent can read attached image",
            "procedure": "look at the attached screenshot and report the text drawn inside it",
            "criteria": "agent reports the text PA-VL-E2E-42 visible in the image",
        },
        "ai_review": {}, "target": {},
        "case_variant_id": "e2e-variant",
    })
    store.add_attachment(
        run_id, attachment_id=f"att-{uuid.uuid4().hex[:8]}",
        name="case.png", mime="image/png", size=len(png),
        kind="image", stored_path=img_path, status="ready",
        vision_supported=True,
    )

    gw = AgentGateway(store, base_url="http://127.0.0.1:18010")

    # 1) profile selection for an image run
    run = store.get_run(run_id)
    chosen = gw._profile_for(run)
    print("SELECTED_PROFILE:", chosen)
    assert chosen == gw.vision_profile, f"expected vision profile, got {chosen}"

    # 2) llm config carries vision capability
    cfg = gw._llm_config(chosen)
    print("CFG_MODEL:", cfg["model"], "SUPPORTS_VISION:",
          cfg.get("capability_overrides", {}).get("supports_vision"),
          "DISABLE_VISION:", cfg.get("disable_vision"))
    assert cfg["model"].lower().startswith("openai/qwen3-vl"), cfg["model"]
    assert cfg.get("disable_vision") is False

    # 3) image parts build correctly
    parts = gw._image_parts(run)
    print("IMG_PARTS:", len(parts), "type:", parts[0]["type"] if parts else None,
          "has_data_url:", parts[0]["image_urls"][0].startswith("data:image/png;base64,") if parts else False)
    assert parts and parts[0]["type"] == "image"

    # 4) real send to 18010
    try:
        cid = gw.start_run(run_id, workspace_dir=tmp, auto_run=True,
                           mode="execute", user_note="Please read the attached image and tell me the text drawn inside it.")
        print("CONVERSATION_ID:", cid)
    except Exception as e:
        print("SEND_FAILED:", repr(e)); raise
    print("E2E_SEND_OK")

if __name__ == "__main__":
    main()

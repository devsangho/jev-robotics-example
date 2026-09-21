# Playground

[English](README.md) | **한국어**

JEV/OpenJEV의 공식 서비스가 아닌 독립적인 Three.js 기반 로보틱스 플레이그라운드. React + TypeScript + Vite로 만들었으며 GitHub Pages에서 정적 호스팅할 수 있습니다.

**[플레이그라운드 열기](https://devsangho.github.io/jev-robotics-example/)**

## 바로 실행

```bash
npm ci
npm run dev
```

http://localhost:5173 에서 실행됩니다. `npm run build`로 `dist/`를 만들고 `npm run preview`로 확인합니다. Node.js 22 이상을 사용하세요.

### 구현된 기능과 경계

| 기능 | 동작 |
| --- | --- |
| 3D 플레이그라운드 | 직접 생성한 Three.js 로봇 팔, 작업대, 물체, 경로, 카메라 조작 |
| 데모 정책 | 5단계의 결정론적 행동 및 점수. 학습 모델이 아닙니다 |
| OpenJEV 연결 | AlexWortega Qwen 4B NLI 모델을 로컬 Python 서버로 실행하고 실제 entailment 점수로 다음 단계를 선택 |
| WebGPU 대안 | WebLLM Qwen3 0.6B 모델을 브라우저에 내려받아 JSON 행동 선택. OpenJEV 체크포인트와 다릅니다 |
| 반복 실험 | 3개 작업, seed별 초기 위치, 최대 20단계, 실행/일시정지/단일 단계/리셋 |
| 기록 | 브라우저 localStorage에 최대 50개 에피소드, 실제 클라이언트 왕복 시간, 행동 점수, JSON 내보내기 |
| 실제 LIBERO 연동 | 별도 Python CLI로 MuJoCo와 사용자 VLA endpoint에 연결. 설치된 VLA 서버가 필요합니다 |

**브라우저 장면은 LIBERO에서 영감을 받은 운동학 데모입니다.** 충돌/접촉 물리, 정식 Franka 관절 운동학, LIBERO 환경 또는 pretrained VLA 실행을 흉내 내어 실측 결과로 표시하지 않습니다. 브라우저 OpenJEV 모드는 알려진 작업 단계가 포함된 텍스트 상태를 입력합니다. 시각적 일반화 성능을 측정하는 실험이 아닙니다. 관측 카메라 미리보기 이미지는 OpenJEV에 전송하지 않습니다.

브라우저용 OpenJEV 4B 체크포인트 변환은 포함하지 않았습니다. 공식 PyTorch 체크포인트와 WebLLM Qwen 모델은 서로 다른 모델입니다. 브라우저 Qwen 모드에서 표시하는 0/100%는 선택 표시이며 보정된 확률이 아닙니다. OpenJEV 점수는 후보별 NLI entailment 확률로, 후보 전체의 합이 1일 필요가 없습니다.

## GitHub Pages 배포

`.github/workflows/deploy.yml`이 `main` push 또는 수동 실행 시 빌드·배포합니다.

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
2. 코드를 `main` 브랜치에 push합니다.
3. **Actions → Deploy Playground to GitHub Pages**의 성공을 확인합니다.

현재 remote 기준 예상 주소:

```text
https://devsangho.github.io/jev-robotics-example/
```

배포 빌드는 `GITHUB_REPOSITORY`에서 저장소 이름을 읽어 Vite의 `base`를 자동 설정합니다. `username.github.io` 저장소는 `/`를 사용합니다. 커스텀 도메인을 쓰려면 base를 `/`로 조정하고 `public/CNAME`을 추가하세요.

로컬에서 Pages 경로 검증:

```bash
GITHUB_PAGES=true GITHUB_REPOSITORY=devsangho/jev-robotics-example npm run build
npm run preview
# http://localhost:4173/jev-robotics-example/
```

GitHub Pages는 Python 서버를 실행하지 않습니다. 3D 데모와 WebGPU 대안은 정적 사이트에서 동작하며, 실제 OpenJEV는 각 사용자가 로컬 서버를 실행해야 합니다. HTTPS 사이트에서 loopback HTTP 접속은 브라우저의 로컬 네트워크 권한 및 정책에 영향을 받습니다. 허용되지 않으면 로컬 개발 주소에서 사용하거나 신뢰된 HTTPS 로컬 프록시를 설정하세요. API 토큰은 필요하지 않습니다.

## AlexWortega OpenJEV 4B

Python 3.11 이상 권장. CUDA, Apple MPS 또는 CPU를 자동 선택합니다. 체크포인트 다운로드에는 약 9 GB 이상의 디스크 공간이 필요하며 모델 및 추론 버퍼를 위한 충분한 메모리도 필요합니다. CPU에서는 float32로 로드하므로 메모리 요구량이 더 큽니다.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
uvicorn server.app:app --host 127.0.0.1 --port 8000
```

첫 시작에서 `AlexWortega/openjev`, `qwen3.5-4b-nli-v2`를 다운로드합니다. 모델 로딩이 끝난 뒤 사이트의 **Model runtime → Connect OpenJEV**를 누릅니다.

선택 환경 변수:

```bash
OPENJEV_DEVICE=cpu                        # cuda / mps / cpu
OPENJEV_SUBFOLDER=qwen3.5-4b-nli-v2        # 기본값
OPENJEV_REVISION=<hugging-face-commit>     # 재현 가능한 실험용 revision 고정
JEV_ALLOWED_ORIGIN=https://YOURNAME.github.io
```

CORS는 localhost 개발 주소와 지정한 Pages origin만 허용합니다. Origin에는 저장소 경로를 넣지 않습니다. 서버는 기본적으로 loopback에만 바인딩하세요. 모델은 임의 remote Python 코드를 실행하지 않고 Transformers 표준 분류 모델 클래스로 로드합니다.

### Bridge API

`GET /health`: `{service, ready, model, device}`

`POST /score`:

```json
{
  "premise": "The gripper is above the red block and is open.",
  "hypotheses": [
    "The appropriate next action is: close the gripper.",
    "The appropriate next action is: release the object."
  ]
}
```

응답: `scores`는 후보 순서의 entailment 확률, `probabilities`는 후보별 `[contradiction, entailment, neutral]`입니다. 요청당 후보는 1~16개, 텍스트는 2048 token까지 잘립니다. 웹 데모는 5개 후보를 사용합니다.

## 브라우저 WebGPU 모델

**Model runtime → Qwen3 0.6B → Load browser model**에서 명시적으로 다운로드를 시작합니다. `Qwen3-0.6B-q4f16_1-MLC` 가중치와 WebLLM 실행 자산을 다운로드하며 브라우저 캐시에 보관합니다. WebGPU를 지원하는 브라우저/기기에서 실행하세요. WebGPU가 없으면 다운로드 버튼이 비활성화됩니다. 메모리 부족·다운로드 실패·잘못된 응답은 오류로 표시하고 scripted 정책으로 자동 대체하지 않습니다.

## 실제 LIBERO + VLA 실험

`server/run_libero.py`는 실제 LIBERO API를 사용하는 **통합용 러너**입니다. LIBERO 설치 및 VLA 모델 서버는 포함되지 않습니다. OpenJEV, LIBERO, VLA는 의존성이 다르므로 **별도 Python 환경/프로세스**를 권장합니다.

1. [공식 LIBERO 설치 가이드](https://github.com/Lifelong-Robot-Learning/LIBERO)에 따라 환경·BDDL·initial states를 준비합니다. Pillow와 NumPy가 필요합니다.
2. 위의 OpenJEV bridge를 다른 환경에서 실행합니다.
3. 아래 계약의 VLA `/candidates` endpoint를 준비합니다. 학습된 LIBERO 정책으로 실제 후보 action chunk들을 생성해야 합니다.
4. LIBERO 환경에서 실행합니다.

```bash
python server/run_libero.py \
  --vla-url http://127.0.0.1:9000/candidates \
  --suite libero_spatial --task 0 --episodes 5 \
  --seed 42 --max-steps 300 --output runs/jev.json

# 동일한 후보 생성 설정과 초기 상태로 candidate 0 baseline 비교
python server/run_libero.py \
  --vla-url http://127.0.0.1:9000/candidates \
  --suite libero_spatial --task 0 --episodes 5 \
  --seed 42 --max-steps 300 --baseline --output runs/baseline.json
```

실제 LIBERO 결과는 CLI가 JSON으로 저장합니다. 현재 웹의 기록 화면은 브라우저 데모 기록만 다룹니다. CLI는 official task initial states를 순서대로 사용하며 task별 `env.check_success()`로 성공을 판정합니다. 이것은 사용자 정의 후보 재정렬 프로토콜이며 published leaderboard 결과와 직접 비교할 수 없습니다. 정식 비교에는 suite 전체, 동일한 전처리·seed·후보·rollout horizon 및 충분한 에피소드가 필요합니다.

### VLA endpoint 계약

요청에는 `instruction`, `suite`, `episode`, `reset`, `seed`, `image_png_base64`, `wrist_png_base64`, `proprio`, `action_convention`이 포함됩니다. PNG는 MuJoCo 이미지의 두 축을 뒤집은 256×256 RGB입니다. 모델별 resize/crop, action unnormalization, gripper 변환은 VLA adapter가 수행해야 합니다. `reset: true`에서는 정책 캐시를 초기화하고 전달받은 seed를 사용하세요.

응답 예시(형식 설명용이며 학습 정책 출력이 아님):

```json
{
  "observation_text": "The open gripper is immediately above the red cube.",
  "candidates": [
    {
      "description": "Close the gripper to grasp the red cube.",
      "actions": [[0, 0, 0, 0, 0, 0, 1]]
    },
    {
      "description": "Move the empty gripper away from the cube.",
      "actions": [[0.1, 0, 0, 0, 0, 0, -1]]
    }
  ]
}
```

각 후보는 의미 설명과 1~32개의 7차원 action을 포함합니다. 후보 수는 1~16개입니다. Action은 LIBERO의 OSC_POSE controller 입력으로 변환된 `[-1, 1]` 값이며, 순서는 delta xyz / rotation axis-angle / gripper입니다. Gripper는 -1=open, +1=closed입니다. 모델 정규화 공간의 출력을 그대로 보내면 안 됩니다.

OpenJEV는 VLA가 제공한 **텍스트 관측과 후보 설명**을 평가합니다. 이미지 grounding 또는 candidate description 품질은 adapter 책임이며, OpenJEV가 raw action의 물리적 성공을 검증한다고 볼 수 없습니다. 후보 0을 VLA baseline으로 취급합니다. endpoint 구현은 OpenVLA, π 계열 등 선택한 모델의 배포 방식에 따라 달라집니다.

## 검증

```bash
npm run build
npx playwright install chromium
npm test
python3 -m unittest discover -s server -p 'test_*.py'
```

Playwright는 실제 WebGL canvas, 에피소드 실행·리셋·기록·export·batch seed·모바일 레이아웃, bridge 응답 처리와 오류를 검사합니다. Bridge 테스트는 HTTP fixture를 사용하며 실제 모델 추론 검증은 아닙니다. 대용량 모델의 실추론과 MuJoCo/VLA end-to-end 실행은 해당 모델과 환경이 설치된 장비에서 별도로 검증해야 합니다.

## 자료

- [AlexWortega OpenJEV 모델 및 NLI 인터페이스](https://huggingface.co/AlexWortega/openjev)
- [LIBERO](https://github.com/Lifelong-Robot-Learning/LIBERO)
- [OpenVLA LIBERO evaluation](https://github.com/openvla/openvla/blob/main/experiments/robot/libero/run_libero_eval.py)
- [WebLLM](https://webllm.mlc.ai/docs/user/basic_usage.html)

독립 실험 프로젝트이며 JEV, OpenJEV 또는 LIBERO 공식 서비스가 아닙니다.

방문자 지도: 사용자 지정 MapMyVisitors 스크립트를 페이지 하단에 포함합니다. 이 위젯은 외부 서비스에서 로드되며, 로컬 모델 추론과는 별개입니다.

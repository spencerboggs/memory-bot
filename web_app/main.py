from flask import Flask, render_template
import json

app = Flask(__name__)

@app.route('/')
def index():
    with open('../shortTermMemory.json', encoding='utf-8') as f:
        data = json.load(f)
    return render_template('index.html', data=data)

@app.route('/data')
def data():
    with open('../shortTermMemory.json', encoding='utf-8') as f:
        data = json.load(f)
    return json.dumps(data)

if __name__ == '__main__':
    app.run(debug=True)
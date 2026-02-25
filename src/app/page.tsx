'use client';

import { useState, useRef } from 'react';
import { Mic, Square, Play, Trash2, CheckCircle, Clock, AlertTriangle, Sparkles, Save, List, Calendar, Settings } from 'lucide-react';

interface Task {
  id: string;
  text: string;
  category: 'urgent' | 'later' | 'completed';
  createdAt: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}

interface Recording {
  id: string;
  blob: Blob;
  url: string;
  createdAt: string;
  duration: number;
  transcript?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'record' | 'tasks' | 'recordings' | 'settings'>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const newRecording: Recording = {
          id: Math.random().toString(36).substr(2, 9),
          blob,
          url,
          createdAt: new Date().toISOString(),
          duration: 0
        };
        setRecordings(prev => [newRecording, ...prev]);
        setSelectedRecording(newRecording);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeRecording = async (recording: Recording) => {
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', recording.blob);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.urgent || data.later) {
        // Convert to tasks
        const urgentTasks: Task[] = (data.urgent || []).map((text: string) => ({
          id: Math.random().toString(36).substr(2, 9),
          text,
          category: 'urgent',
          createdAt: new Date().toISOString(),
          priority: 'high'
        }));
        
        const laterTasks: Task[] = (data.later || []).map((text: string) => ({
          id: Math.random().toString(36).substr(2, 9),
          text,
          category: 'later',
          createdAt: new Date().toISOString(),
          priority: 'medium'
        }));
        
        setTasks(prev => [...urgentTasks, ...laterTasks, ...prev]);
        
        // Update recording with transcript
        setRecordings(prev => prev.map(r => 
          r.id === recording.id 
            ? { ...r, transcript: data.urgent?.concat(data.later)?.join('\n') }
            : r
        ));
        
        setActiveTab('tasks');
      }
    } catch (error) {
      console.error('Error transcribing:', error);
    } finally {
      setTranscribing(false);
    }
  };

  const deleteRecording = (id: string) => {
    setRecordings(prev => prev.filter(r => r.id !== id));
    if (selectedRecording?.id === id) setSelectedRecording(null);
  };

  const toggleTaskComplete = (id: string) => {
    setTasks(prev => prev.map(task => 
      task.id === id 
        ? { ...task, category: task.category === 'completed' ? 'later' : 'completed' }
        : task
    ));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTaskPriority = (id: string, priority: 'low' | 'medium' | 'high') => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, priority } : task
    ));
  };

  const urgentTasks = tasks.filter(t => t.category === 'urgent');
  const laterTasks = tasks.filter(t => t.category === 'later');
  const completedTasks = tasks.filter(t => t.category === 'completed');

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-amber-600 p-3 rounded-full">
              <Mic className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">VoiceTask</h1>
          <p className="text-gray-400">AI voice-to-text task organizer</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { id: 'record', label: 'Record', icon: Mic },
            { id: 'tasks', label: 'Tasks', icon: List },
            { id: 'recordings', label: 'Recordings', icon: Save },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all ${
                activeTab === id
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'tasks' && tasks.length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {tasks.filter(t => t.category !== 'completed').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Record Tab */}
        {activeTab === 'record' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700 text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">Voice Recorder</h2>
              <p className="text-gray-400 mb-8">
                Record your thoughts, ideas, or to-do list. AI will transcribe and organize tasks automatically.
              </p>
              
              <div className="flex justify-center mb-8">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-12 h-12 text-white" />
                  ) : (
                    <Mic className="w-12 h-12 text-white" />
                  )}
                </button>
              </div>
              
              <p className="text-gray-500">
                {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
              </p>

              {selectedRecording && (
                <div className="mt-8 p-4 bg-gray-900 rounded-xl">
                  <audio src={selectedRecording.url} controls className="w-full mb-4" />
                  <button
                    onClick={() => transcribeRecording(selectedRecording)}
                    disabled={transcribing}
                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {transcribing ? 'Transcribing...' : 'Transcribe & Organize'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                <div className="text-2xl font-bold text-red-400">{urgentTasks.length}</div>
                <div className="text-sm text-gray-400">Urgent</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                <div className="text-2xl font-bold text-amber-400">{laterTasks.length}</div>
                <div className="text-sm text-gray-400">Later</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                <div className="text-2xl font-bold text-emerald-400">{completedTasks.length}</div>
                <div className="text-sm text-gray-400">Done</div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-white">Your Tasks</h2>
              <span className="text-gray-400">{tasks.filter(t => t.category !== 'completed').length} active</span>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
                <List className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">No tasks yet.</p>
                <p className="text-gray-500 text-sm mt-2">Record a voice memo and transcribe it!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Urgent Tasks */}
                {urgentTasks.length > 0 && (
                  <div>
                    <h3 className="text-red-400 font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Urgent ({urgentTasks.length})
                    </h3>
                    <div className="space-y-2">
                      {urgentTasks.map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          onToggle={() => toggleTaskComplete(task.id)}
                          onDelete={() => deleteTask(task.id)}
                          onPriorityChange={(p) => updateTaskPriority(task.id, p)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Later Tasks */}
                {laterTasks.length > 0 && (
                  <div>
                    <h3 className="text-amber-400 font-semibold mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Later ({laterTasks.length})
                    </h3>
                    <div className="space-y-2">
                      {laterTasks.map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          onToggle={() => toggleTaskComplete(task.id)}
                          onDelete={() => deleteTask(task.id)}
                          onPriorityChange={(p) => updateTaskPriority(task.id, p)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Tasks */}
                {completedTasks.length > 0 && (
                  <div>
                    <h3 className="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Completed ({completedTasks.length})
                    </h3>
                    <div className="space-y-2 opacity-60">
                      {completedTasks.map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          onToggle={() => toggleTaskComplete(task.id)}
                          onDelete={() => deleteTask(task.id)}
                          onPriorityChange={(p) => updateTaskPriority(task.id, p)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recordings Tab */}
        {activeTab === 'recordings' && (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-white mb-6">Saved Recordings</h2>
            
            {recordings.length === 0 ? (
              <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
                <Save className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">No recordings yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recordings.map(recording => (
                  <div key={recording.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-gray-400 text-sm">
                          {new Date(recording.createdAt).toLocaleString()}
                        </span>
                        {recording.transcript && (
                          <span className="ml-3 bg-emerald-900 text-emerald-300 px-2 py-1 rounded text-xs">
                            Transcribed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteRecording(recording.id)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <audio src={recording.url} controls className="w-full mb-4" />
                    
                    {recording.transcript && (
                      <div className="bg-gray-900 rounded-lg p-4 mt-4">
                        <p className="text-gray-300 text-sm whitespace-pre-line">{recording.transcript}</p>
                      </div>
                    )}
                    
                    {!recording.transcript && (
                      <button
                        onClick={() => transcribeRecording(recording)}
                        disabled={transcribing}
                        className="mt-4 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                      >
                        {transcribing ? 'Transcribing...' : 'Transcribe'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-white mb-6">Settings</h2>
            
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Data Management</h3>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (confirm('Clear all tasks?')) setTasks([]);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg transition-colors"
                >
                  Clear All Tasks ({tasks.length})
                </button>
                <button
                  onClick={() => {
                    if (confirm('Clear all recordings?')) {
                      setRecordings([]);
                      setSelectedRecording(null);
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg transition-colors"
                >
                  Clear All Recordings ({recordings.length})
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">About</h3>
              <p className="text-gray-400">
                VoiceTask uses OpenAI Whisper API for transcription and GPT-4o-mini for task organization.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Task Item Component
function TaskItem({ 
  task, 
  onToggle, 
  onDelete,
  onPriorityChange 
}: { 
  task: Task; 
  onToggle: () => void; 
  onDelete: () => void;
  onPriorityChange: (p: 'low' | 'medium' | 'high') => void;
}) {
  const priorityColors = {
    low: 'bg-gray-700 text-gray-300',
    medium: 'bg-amber-700 text-amber-300',
    high: 'bg-red-700 text-red-300'
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.category === 'completed'
              ? 'bg-emerald-600 border-emerald-600'
              : 'border-gray-500 hover:border-emerald-500'
          }`}
        >
          {task.category === 'completed' && <CheckCircle className="w-4 h-4 text-white" />}
        </button>
        <span className={`text-gray-200 ${task.category === 'completed' ? 'line-through opacity-50' : ''}`}>
          {task.text}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={task.priority}
          onChange={(e) => onPriorityChange(e.target.value as any)}
          className={`text-xs px-2 py-1 rounded ${priorityColors[task.priority]}`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={onDelete}
          className="text-gray-500 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Mic className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl font-semibold tracking-tight">VoiceTask</h1>
          </div>
          <p className="text-neutral-500">AI voice-to-text task organizer</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-10 border-b border-neutral-800">
          {[
            { id: 'record', label: 'Record', icon: Mic },
            { id: 'tasks', label: 'Tasks', icon: List },
            { id: 'recordings', label: 'Recordings', icon: Save },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? 'border-violet-400 text-white'
                  : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'tasks' && tasks.length > 0 && (
                <span className="text-xs text-violet-400">
                  {tasks.filter(t => t.category !== 'completed').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Record Tab */}
        {activeTab === 'record' && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl border border-neutral-800 p-8 text-center">
              <h2 className="text-lg font-medium mb-2">Voice Recorder</h2>
              <p className="text-neutral-500 text-sm mb-8">
                Record your thoughts, ideas, or to-do list. AI will transcribe and organize tasks automatically.
              </p>
              
              <div className="flex justify-center mb-6">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all border-2 ${
                    isRecording 
                      ? 'border-red-500 bg-red-500/10 animate-pulse' 
                      : 'border-violet-400 bg-violet-400/10 hover:bg-violet-400/20'
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-8 h-8 text-red-400" />
                  ) : (
                    <Mic className="w-8 h-8 text-violet-400" />
                  )}
                </button>
              </div>
              
              <p className="text-neutral-600 text-sm">
                {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
              </p>

              {selectedRecording && (
                <div className="mt-8 p-4 rounded-lg border border-neutral-800">
                  <audio src={selectedRecording.url} controls className="w-full mb-4" />
                  <button
                    onClick={() => transcribeRecording(selectedRecording)}
                    disabled={transcribing}
                    className="w-full bg-violet-500 hover:bg-violet-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    {transcribing ? 'Transcribing...' : 'Transcribe & Organize'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="rounded-lg border border-neutral-800 p-4 text-center">
                <div className="text-xl font-semibold text-red-400">{urgentTasks.length}</div>
                <div className="text-xs text-neutral-500 mt-1">Urgent</div>
              </div>
              <div className="rounded-lg border border-neutral-800 p-4 text-center">
                <div className="text-xl font-semibold text-violet-400">{laterTasks.length}</div>
                <div className="text-xs text-neutral-500 mt-1">Later</div>
              </div>
              <div className="rounded-lg border border-neutral-800 p-4 text-center">
                <div className="text-xl font-semibold text-green-400">{completedTasks.length}</div>
                <div className="text-xs text-neutral-500 mt-1">Done</div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium">Your Tasks</h2>
              <span className="text-neutral-500 text-sm">{tasks.filter(t => t.category !== 'completed').length} active</span>
            </div>

            {tasks.length === 0 ? (
              <div className="text-center py-16 rounded-xl border border-neutral-800">
                <List className="w-10 h-10 mx-auto mb-3 text-neutral-700" />
                <p className="text-neutral-500 text-sm">No tasks yet.</p>
                <p className="text-neutral-600 text-xs mt-1">Record a voice memo and transcribe it!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Urgent Tasks */}
                {urgentTasks.length > 0 && (
                  <div>
                    <h3 className="text-red-400 text-sm font-medium mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
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
                    <h3 className="text-violet-400 text-sm font-medium mb-3 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
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
                    <h3 className="text-green-400 text-sm font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5" />
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
            <h2 className="text-lg font-medium mb-6">Saved Recordings</h2>
            
            {recordings.length === 0 ? (
              <div className="text-center py-16 rounded-xl border border-neutral-800">
                <Save className="w-10 h-10 mx-auto mb-3 text-neutral-700" />
                <p className="text-neutral-500 text-sm">No recordings yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recordings.map(recording => (
                  <div key={recording.id} className="rounded-xl border border-neutral-800 p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-xs">
                          {new Date(recording.createdAt).toLocaleString()}
                        </span>
                        {recording.transcript && (
                          <span className="text-green-400 text-xs font-medium">
                            Transcribed
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteRecording(recording.id)}
                        className="text-neutral-600 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <audio src={recording.url} controls className="w-full mb-3" />
                    
                    {recording.transcript && (
                      <div className="rounded-lg border border-neutral-800 p-4 mt-3">
                        <p className="text-neutral-300 text-sm whitespace-pre-line">{recording.transcript}</p>
                      </div>
                    )}
                    
                    {!recording.transcript && (
                      <button
                        onClick={() => transcribeRecording(recording)}
                        disabled={transcribing}
                        className="mt-3 w-full bg-violet-500 hover:bg-violet-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white py-2 rounded-lg transition-colors text-sm"
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
            <h2 className="text-lg font-medium mb-6">Settings</h2>
            
            <div className="rounded-xl border border-neutral-800 p-6 mb-4">
              <h3 className="text-sm font-medium mb-4">Data Management</h3>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (confirm('Clear all tasks?')) setTasks([]);
                  }}
                  className="w-full border border-red-400/20 text-red-400 hover:bg-red-400/10 py-2.5 rounded-lg transition-colors text-sm"
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
                  className="w-full border border-red-400/20 text-red-400 hover:bg-red-400/10 py-2.5 rounded-lg transition-colors text-sm"
                >
                  Clear All Recordings ({recordings.length})
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-800 p-6">
              <h3 className="text-sm font-medium mb-2">About</h3>
              <p className="text-neutral-500 text-sm">
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
    low: 'text-neutral-500 border-neutral-800',
    medium: 'text-violet-400 border-violet-400/20',
    high: 'text-red-400 border-red-400/20'
  };

  return (
    <div className="rounded-lg border border-neutral-800 p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
            task.category === 'completed'
              ? 'bg-green-500 border-green-500'
              : 'border-neutral-600 hover:border-violet-400'
          }`}
        >
          {task.category === 'completed' && <CheckCircle className="w-3 h-3 text-white" />}
        </button>
        <span className={`text-sm ${task.category === 'completed' ? 'line-through text-neutral-600' : 'text-neutral-200'}`}>
          {task.text}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={task.priority}
          onChange={(e) => onPriorityChange(e.target.value as any)}
          className={`text-xs px-2 py-0.5 rounded border bg-transparent ${priorityColors[task.priority]}`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button
          onClick={onDelete}
          className="text-neutral-600 hover:text-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SubscriptionTierResource\Pages;
use App\Filament\Resources\SubscriptionTierResource\RelationManagers;
use App\Models\SubscriptionTier;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class SubscriptionTierResource extends Resource
{
    protected static ?string $model = SubscriptionTier::class;

    protected static ?string $navigationIcon = 'heroicon-o-rectangle-stack';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                Forms\Components\TextInput::make('price_kes')
                    ->numeric(),
                Forms\Components\TextInput::make('product_limit')
                    ->numeric(),
                Forms\Components\TextInput::make('branch_limit')
                    ->numeric(),
                Forms\Components\TextInput::make('ai_token_limit')
                    ->numeric(),
                Forms\Components\TextInput::make('features')
                    ->required(),
                Forms\Components\Toggle::make('is_active')
                    ->required(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable(),
                Tables\Columns\TextColumn::make('price_kes')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('product_limit')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('branch_limit')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\TextColumn::make('ai_token_limit')
                    ->numeric()
                    ->sortable(),
                Tables\Columns\IconColumn::make('is_active')
                    ->boolean(),
                Tables\Columns\TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
                Tables\Columns\TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            //
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSubscriptionTiers::route('/'),
            'create' => Pages\CreateSubscriptionTier::route('/create'),
            'edit' => Pages\EditSubscriptionTier::route('/{record}/edit'),
        ];
    }
}
